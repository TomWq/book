#![cfg_attr(all(windows, not(debug_assertions)), windows_subsystem = "windows")]

use std::{
    env,
    fs::{self, OpenOptions},
    io::{BufRead, BufReader, Read, Write},
    net::{TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

#[cfg(unix)]
use std::os::unix::process::CommandExt;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use tauri::{
    menu::{MenuBuilder, SubmenuBuilder},
    webview::PageLoadEvent,
    AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};
use url::Url;

const APP_NAME: &str = "AI 网文写作助手";
const DEFAULT_PORT: u16 = 3131;
const DEFAULT_LICENSE_SERVER_URL: &str = "http://62.234.205.107";
const DEFAULT_LICENSE_SERVER_TIMEOUT_MS: &str = "30000";
const DEFAULT_UPDATER_PUBLIC_KEY: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEE3M0I3RkZFQkM5NzVGNApSV1QwZGNuci83ZHpDdnJrYlJtdUloV1p5SERoSGZiVHJPdUc5MXJXNUtrTk9MU1dzZzZRM2dCKwo=";
const MENU_OPEN_LOGS: &str = "open_logs_dir";
const SPLASH_WINDOW: &str = "splash";
const MAIN_WINDOW: &str = "main";
const MAIN_WINDOW_ENTER_SCRIPT: &str = r#"
(() => {
  if (window.__tauriWindowEnterInstalled) return;
  window.__tauriWindowEnterInstalled = true;

  const css = `
    html.app-window-entering,
    html.app-window-entering body {
      background: #0d1320 !important;
    }

    html.app-window-entering body {
      opacity: 0;
      transform: scale(0.998);
      transform-origin: center;
      transition:
        opacity 540ms linear,
        transform 540ms linear;
    }

    html.app-window-entering.app-window-ready body {
      opacity: 1;
      transform: none;
    }

    @media (prefers-reduced-motion: reduce) {
      html.app-window-entering body {
        transition-duration: 1ms !important;
      }
    }
  `;

  const install = () => {
    if (!document.getElementById("tauri-window-enter-style")) {
      const style = document.createElement("style");
      style.id = "tauri-window-enter-style";
      style.textContent = css;
      (document.head || document.documentElement).appendChild(style);
    }
    document.documentElement.classList.add("app-window-entering");
  };

  document.documentElement.classList.add("app-window-entering");

  if (document.head) {
    install();
  } else {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  }
})();
"#;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn append_log(log_path: &Path, message: impl AsRef<str>) {
    if let Some(parent) = log_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(log_path) {
        let _ = writeln!(file, "[{}] {}", timestamp_ms(), message.as_ref());
    }
}

fn timestamp_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn find_free_port(start: u16) -> Result<u16, String> {
    for port in start..start + 200 {
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return Ok(port);
        }
    }

    Err("没有找到可用的本地端口".to_string())
}

fn wait_for_port(port: u16, child: &mut Child, log_path: &Path) -> Result<(), String> {
    let started_at = SystemTime::now();

    loop {
        if std::net::TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return Ok(());
        }

        match child.try_wait() {
            Ok(Some(status)) => {
                append_log(
                    log_path,
                    format!("Next service exited before port ready: {}", status),
                );
                return Err(format!(
                    "本地 Next 服务启动失败，进程提前退出（{}）。请查看 tauri.log 里的 next:error。",
                    status
                ));
            }
            Ok(None) => {}
            Err(error) => {
                append_log(log_path, format!("checking Next service failed: {}", error));
                return Err(format!("检查本地 Next 服务状态失败：{}", error));
            }
        }

        if started_at.elapsed().unwrap_or_default() > Duration::from_secs(45) {
            return Err("本地 Next 服务启动超时".to_string());
        }

        thread::sleep(Duration::from_millis(300));
    }
}

fn request_http_status(port: u16, path: &str) -> Result<u16, String> {
    let mut stream = TcpStream::connect(("127.0.0.1", port))
        .map_err(|error| format!("连接本地服务失败：{}", error))?;

    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(5)));

    let request = format!(
        "GET {} HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: close\r\n\r\n",
        path, port
    );

    stream
        .write_all(request.as_bytes())
        .map_err(|error| format!("请求本地服务失败：{}", error))?;

    let mut response = String::new();
    stream
        .read_to_string(&mut response)
        .map_err(|error| format!("读取本地服务响应失败：{}", error))?;

    let status_line = response.lines().next().unwrap_or_default();
    let status = status_line
        .split_whitespace()
        .nth(1)
        .and_then(|value| value.parse::<u16>().ok())
        .ok_or_else(|| format!("本地服务响应异常：{}", status_line))?;

    Ok(status)
}

fn wait_for_http_route(port: u16, path: &str, log_path: &Path) -> Result<u16, String> {
    let started_at = SystemTime::now();

    loop {
        match request_http_status(port, path) {
            Ok(status) if status < 500 => {
                append_log(log_path, format!("startup route {} => {}", path, status));
                return Ok(status);
            }
            Ok(status) => {
                append_log(log_path, format!("startup route {} => {}", path, status));
                return Err(format!(
                    "启动页渲染失败：{} 返回 HTTP {}。请通过“帮助 > 打开日志目录”把 tauri.log 发给开发者。",
                    path, status
                ));
            }
            Err(error) => {
                if started_at.elapsed().unwrap_or_default() > Duration::from_secs(30) {
                    append_log(
                        log_path,
                        format!("startup route {} failed: {}", path, error),
                    );
                    return Err(format!("启动页检查失败：{}，{}", path, error));
                }
            }
        }

        thread::sleep(Duration::from_millis(300));
    }
}

fn ensure_dir(path: &Path) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|error| format!("创建目录失败：{}，{}", path.display(), error))
}

fn current_project_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .to_path_buf()
}

fn resource_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .resource_dir()
        .unwrap_or_else(|_| current_project_dir())
}

fn node_binary_name() -> &'static str {
    if cfg!(windows) {
        "node.exe"
    } else {
        "node"
    }
}

fn first_existing(paths: &[PathBuf]) -> Option<PathBuf> {
    paths.iter().find(|path| path.exists()).cloned()
}

fn env_or_default(name: &str, default_value: &str) -> String {
    env::var(name)
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| default_value.to_string())
}

fn is_packaged_build() -> bool {
    !cfg!(debug_assertions)
}

fn resolve_node(resources: &Path) -> Result<PathBuf, String> {
    let project_dir = current_project_dir();
    let node_name = node_binary_name();
    let candidates = vec![
        resources.join("node-runtime").join(node_name),
        resources.join("node-runtime").join("bin").join(node_name),
        project_dir
            .join("node_modules")
            .join("node")
            .join("bin")
            .join(node_name),
        project_dir
            .join("node_modules")
            .join("node")
            .join("node_modules")
            .join(format!(
                "node-bin-{}-{}",
                env::consts::OS,
                env::consts::ARCH
            ))
            .join("bin")
            .join(node_name),
    ];

    if let Some(path) = first_existing(&candidates) {
        return Ok(path);
    }

    if is_packaged_build() {
        Err("未找到随包携带的 Node runtime，请先执行 Tauri 构建准备。".to_string())
    } else {
        Ok(PathBuf::from("node"))
    }
}

fn resolve_app_root(resources: &Path) -> PathBuf {
    if is_packaged_build() {
        resources.join("app")
    } else {
        current_project_dir()
    }
}

fn resolve_standalone_server(app_root: &Path) -> Result<PathBuf, String> {
    let server = app_root.join(".next").join("standalone").join("server.js");

    if server.exists() {
        Ok(server)
    } else {
        Err(format!(
            "未找到 Next standalone 服务：{}。请先执行 npm run tauri:prepare。",
            server.display()
        ))
    }
}

fn resolve_server_wrapper(resources: &Path) -> Result<PathBuf, String> {
    let candidates = vec![
        resources.join("node-server-wrapper.cjs"),
        current_project_dir()
            .join("src-tauri")
            .join("node-server-wrapper.cjs"),
    ];

    first_existing(&candidates).ok_or_else(|| "未找到 Tauri 服务启动包装器".to_string())
}

fn read_or_create_machine_hash(data_dir: &Path) -> Result<String, String> {
    let machine_path = data_dir.join("machine-id.txt");

    if let Ok(value) = fs::read_to_string(&machine_path) {
        let value = value.trim().to_string();
        if !value.is_empty() {
            return Ok(value);
        }
    }

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let value = format!(
        "tauri-prototype-{}-{}-{}",
        env::consts::OS,
        env::consts::ARCH,
        timestamp
    );

    fs::write(&machine_path, &value)
        .map_err(|error| format!("写入机器标识失败：{}，{}", machine_path.display(), error))?;

    Ok(value)
}

fn spawn_pipe_logger<R: std::io::Read + Send + 'static>(
    reader: R,
    log_path: PathBuf,
    label: &'static str,
) {
    thread::spawn(move || {
        let reader = BufReader::new(reader);

        for line in reader.lines().map_while(Result::ok) {
            append_log(&log_path, format!("[{}] {}", label, line));
        }
    });
}

fn start_next_server(app: &AppHandle) -> Result<(Child, String), String> {
    if let Ok(url) = env::var("TAURI_NEXT_URL") {
        if !url.trim().is_empty() {
            return Err("TAURI_NEXT_URL 模式不需要启动本地服务".to_string());
        }
    }

    let resources = resource_dir(app);
    let app_root = resolve_app_root(&resources);
    let server = resolve_standalone_server(&app_root)?;
    let wrapper = resolve_server_wrapper(&resources)?;
    let node = resolve_node(&resources)?;
    let port = find_free_port(DEFAULT_PORT)?;
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("读取应用数据目录失败：{}", error))?;
    let logs_dir = data_dir.join("logs");
    let log_path = logs_dir.join("tauri.log");

    ensure_dir(&data_dir)?;
    ensure_dir(&logs_dir)?;
    append_log(&log_path, format!("{} Tauri starting", APP_NAME));
    append_log(&log_path, format!("resources={}", resources.display()));
    append_log(&log_path, format!("app_root={}", app_root.display()));
    append_log(&log_path, format!("node={}", node.display()));
    append_log(&log_path, format!("wrapper={}", wrapper.display()));
    append_log(&log_path, format!("server={}", server.display()));

    let machine_hash = read_or_create_machine_hash(&data_dir)?;
    let license_server_url = env_or_default("LICENSE_SERVER_URL", DEFAULT_LICENSE_SERVER_URL);
    let license_server_timeout_ms = env_or_default(
        "LICENSE_SERVER_TIMEOUT_MS",
        DEFAULT_LICENSE_SERVER_TIMEOUT_MS,
    );
    let app_store_path = data_dir.join("app-db.json");
    let sqlite_path = data_dir.join("license-center.db");
    let cwd = server
        .parent()
        .ok_or_else(|| "Next standalone 服务路径无效".to_string())?;

    append_log(
        &log_path,
        format!("license_server_url={}", license_server_url),
    );

    let mut command = Command::new(node);
    command
        .arg(&wrapper)
        .arg(&server)
        .arg(port.to_string())
        .current_dir(cwd)
        .env("PORT", port.to_string())
        .env("HOSTNAME", "127.0.0.1")
        .env("APP_RUNTIME", "desktop")
        .env("NEXT_PUBLIC_APP_RUNTIME", "desktop")
        .env("AUTH_COOKIE_SECURE", "false")
        .env("APP_STORE_PATH", app_store_path)
        .env("DATABASE_URL", format!("file:{}", sqlite_path.display()))
        .env("LICENSE_SERVER_URL", license_server_url)
        .env("LICENSE_SERVER_TIMEOUT_MS", license_server_timeout_ms)
        .env("DESKTOP_MACHINE_HASH", machine_hash)
        .env("DESKTOP_LOG_PATH", &log_path)
        .env("NEXT_STANDALONE_ROOT", cwd)
        .env("ELECTRON_APP_ROOT", app_root)
        .env("TAURI_PARENT_PID", std::process::id().to_string())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(unix)]
    command.process_group(0);

    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);

    let mut child = command
        .spawn()
        .map_err(|error| format!("启动本地 Next 服务失败：{}", error))?;

    if let Some(stdout) = child.stdout.take() {
        spawn_pipe_logger(stdout, log_path.clone(), "next");
    }

    if let Some(stderr) = child.stderr.take() {
        spawn_pipe_logger(stderr, log_path.clone(), "next:error");
    }

    append_log(&log_path, format!("waiting for port {}", port));
    wait_for_port(port, &mut child, &log_path)?;
    append_log(&log_path, format!("ready on port {}", port));
    let _ = wait_for_http_route(port, "/api/health", &log_path)?;
    let _ = wait_for_http_route(port, "/activate", &log_path)?;

    Ok((child, format!("http://127.0.0.1:{}", port)))
}

fn kill_server_process(server_process: &Arc<Mutex<Option<Child>>>) {
    if let Some(mut child) = server_process.lock().unwrap().take() {
        terminate_process_group(child.id());
        let _ = child.kill();
        let _ = child.wait();
    }
}

#[cfg(unix)]
fn terminate_process_group(pid: u32) {
    let _ = Command::new("kill")
        .arg("-TERM")
        .arg(format!("-{}", pid))
        .status();
}

#[cfg(not(unix))]
fn terminate_process_group(_pid: u32) {}

fn show_startup_failure(window: &WebviewWindow, message: &str) {
    let escaped = message
        .replace('\\', "\\\\")
        .replace('`', "\\`")
        .replace('$', "\\$");
    let script = format!(
    "document.body.innerHTML = `<main class=\"shell error\"><div class=\"mark\">!</div><h1>启动失败</h1><p>{}</p><small>请关闭后重新打开，或发送 tauri.log 给开发者。</small></main>`;",
    escaped
  );
    let _ = window.eval(script);
}

fn transition_to_main_window(main_window: WebviewWindow, splash: WebviewWindow) {
    let _ = splash.eval("document.body.classList.add('is-leaving');");
    thread::sleep(Duration::from_millis(260));

    let _ = main_window.show();
    let _ = main_window.center();
    let _ = main_window.eval(
        r#"
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const root = document.documentElement;
            root.classList.add("app-window-ready");

            window.setTimeout(() => {
              root.classList.remove("app-window-entering", "app-window-ready");
              document.getElementById("tauri-window-enter-style")?.remove();
            }, 700);
          });
        });
        "#,
    );

    thread::sleep(Duration::from_millis(620));
    let _ = main_window.set_focus();
    let _ = splash.hide();
}

fn setup_app_menu(app: &mut tauri::App) -> tauri::Result<()> {
    let app_menu = SubmenuBuilder::new(app, APP_NAME)
        .about(None)
        .separator()
        .quit_with_text("退出")
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "编辑")
        .undo_with_text("撤销")
        .redo_with_text("重做")
        .separator()
        .cut_with_text("剪切")
        .copy_with_text("复制")
        .paste_with_text("粘贴")
        .select_all_with_text("全选")
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "窗口")
        .minimize_with_text("最小化")
        .fullscreen_with_text("进入全屏")
        .close_window_with_text("关闭窗口")
        .build()?;

    let help_menu = SubmenuBuilder::new(app, "帮助")
        .text(MENU_OPEN_LOGS, "打开日志目录")
        .build()?;

    let menu = MenuBuilder::new(app)
        .item(&app_menu)
        .item(&edit_menu)
        .item(&window_menu)
        .item(&help_menu)
        .build()?;

    app.set_menu(menu)?;
    Ok(())
}

fn open_path_in_system(path: &Path) {
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(path);
        command
    };

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("explorer");
        command.arg(path);
        command
    };

    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(path);
        command
    };

    let _ = command.spawn();
}

fn open_logs_dir(app: &AppHandle) {
    if let Ok(data_dir) = app.path().app_data_dir() {
        let logs_dir = data_dir.join("logs");
        let _ = fs::create_dir_all(&logs_dir);
        open_path_in_system(&logs_dir);
    }
}

fn create_main_window(
    app: &AppHandle,
    splash: WebviewWindow,
    main_window_ready: Arc<AtomicBool>,
    url: &str,
) -> Result<(), String> {
    let parsed = Url::parse(url).map_err(|error| format!("应用地址无效：{}，{}", url, error))?;

    let splash_for_load = splash.clone();
    WebviewWindowBuilder::new(app, MAIN_WINDOW, WebviewUrl::External(parsed))
        .title(APP_NAME)
        .inner_size(1280.0, 860.0)
        .min_inner_size(1040.0, 720.0)
        .center()
        .resizable(true)
        .visible(false)
        .initialization_script(MAIN_WINDOW_ENTER_SCRIPT)
        .on_page_load(move |main_window, payload| {
            if payload.event() == PageLoadEvent::Finished
                && !main_window_ready.swap(true, Ordering::SeqCst)
            {
                let main_for_transition = main_window.clone();
                let splash_for_transition = splash_for_load.clone();

                thread::spawn(move || {
                    transition_to_main_window(main_for_transition, splash_for_transition);
                });
            }
        })
        .build()
        .map_err(|error| format!("创建主窗口失败：{}", error))?;

    Ok(())
}

fn main() {
    let server_process: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(None));
    let server_process_for_setup = Arc::clone(&server_process);
    let main_window_ready = Arc::new(AtomicBool::new(false));
    let main_window_ready_for_setup = Arc::clone(&main_window_ready);

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_updater::Builder::new()
                .pubkey(env_or_default(
                    "TAURI_UPDATER_PUBLIC_KEY",
                    DEFAULT_UPDATER_PUBLIC_KEY,
                ))
                .build(),
        )
        .setup(move |app| -> Result<(), Box<dyn std::error::Error>> {
            setup_app_menu(app)?;

            let splash =
                WebviewWindowBuilder::new(app, SPLASH_WINDOW, WebviewUrl::App("index.html".into()))
                    .title(APP_NAME)
                    .inner_size(1280.0, 860.0)
                    .center()
                    .resizable(false)
                    .build()?;

            let app_handle = app.handle().clone();
            let splash_for_thread = splash.clone();
            let server_process_for_thread = Arc::clone(&server_process_for_setup);
            let main_window_ready_for_thread = Arc::clone(&main_window_ready_for_setup);

            thread::spawn(move || {
                let url = match env::var("TAURI_NEXT_URL") {
                    Ok(url) if !url.trim().is_empty() => url,
                    _ => match start_next_server(&app_handle) {
                        Ok((child, url)) => {
                            *server_process_for_thread.lock().unwrap() = Some(child);
                            url
                        }
                        Err(message) => {
                            show_startup_failure(&splash_for_thread, &message);
                            return;
                        }
                    },
                };

                if let Err(message) = create_main_window(
                    &app_handle,
                    splash_for_thread.clone(),
                    main_window_ready_for_thread,
                    &url,
                ) {
                    show_startup_failure(&splash_for_thread, &message);
                }
            });

            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id() == MENU_OPEN_LOGS {
                open_logs_dir(app);
            }
        })
        .build(tauri::generate_context!())
        .expect("启动桌面端失败");

    app.run(move |handle, event| match event {
        tauri::RunEvent::Exit | tauri::RunEvent::ExitRequested { .. } => {
            kill_server_process(&server_process);
        }
        tauri::RunEvent::WindowEvent { label, event, .. } => {
            if label == MAIN_WINDOW
                && matches!(
                    event,
                    tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed
                )
            {
                kill_server_process(&server_process);
            }

            if label == SPLASH_WINDOW
                && matches!(
                    event,
                    tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed
                )
                && !main_window_ready.load(Ordering::SeqCst)
                && handle.get_webview_window(MAIN_WINDOW).is_none()
            {
                kill_server_process(&server_process);
                handle.exit(0);
            }
        }
        _ => {}
    });
}
