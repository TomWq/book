import type { StoredChapterDraft } from "@/lib/project-types";

export function countTextCharacters(value: string) {
  return value.replace(/\s/g, "").length;
}

export function isSameLocalDay(value: string, date: Date) {
  const target = new Date(value);

  return (
    target.getFullYear() === date.getFullYear() &&
    target.getMonth() === date.getMonth() &&
    target.getDate() === date.getDate()
  );
}

export function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localDateLabel(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function recentCalendarDays(days = 35) {
  const today = new Date();

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - index - 1));
    return date;
  });
}

export function intensityForCharacters(characters: number) {
  if (characters >= 5000) {
    return "level-4";
  }

  if (characters >= 3000) {
    return "level-3";
  }

  if (characters >= 1000) {
    return "level-2";
  }

  if (characters > 0) {
    return "level-1";
  }

  return "level-0";
}

export function buildCharactersByDay(drafts: StoredChapterDraft[]) {
  const charactersByDay = new Map<string, number>();

  drafts.forEach((draft) => {
    const key = localDateKey(new Date(draft.createdAt));
    charactersByDay.set(key, (charactersByDay.get(key) ?? 0) + countTextCharacters(draft.content));
  });

  return charactersByDay;
}

export function countWritingStreak(charactersByDay: Map<string, number>) {
  const date = new Date();
  let streak = 0;

  while (true) {
    const key = localDateKey(date);

    if ((charactersByDay.get(key) ?? 0) <= 0) {
      break;
    }

    streak += 1;
    date.setDate(date.getDate() - 1);
  }

  return streak;
}
