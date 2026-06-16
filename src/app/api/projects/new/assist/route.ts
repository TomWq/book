import { assistProjectCreation } from "@/lib/projects";
import type { ProjectCreationCharacterInput, ProjectCreationCharacterRole } from "@/lib/ai/project-creation";
import { novelTaxonomy, qidianTaxonomyByReader, readerOptions, type TargetReader } from "@/lib/novel-taxonomy";

export const runtime = "nodejs";
const maxProjectCharacters = 20;

function list(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : String(value ?? "")
        .split(/\r?\n|，|、/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function defaultCharacterRoleForReader(index: number, targetReader?: TargetReader | ""): ProjectCreationCharacterRole {
  return targetReader === "女频"
    ? index === 0
      ? "女主"
      : index === 1
        ? "男主"
        : "女配"
    : index === 1
      ? "女主"
      : "男主";
}

function characterList(value: unknown, targetReader?: TargetReader | ""): ProjectCreationCharacterInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((item, index) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const raw = item as { role?: unknown; name?: unknown };
      const role = String(raw.role ?? "").trim();
      const normalizedRole: ProjectCreationCharacterRole =
        role === "男主" || role === "女主" || role === "男配" || role === "女配"
          ? role
          : defaultCharacterRoleForReader(index, targetReader);

      return [{
        role: normalizedRole,
        name: String(raw.name ?? "").trim()
      }];
    })
    .slice(0, maxProjectCharacters);
}

function readWorkLengthType(value: unknown) {
  return value === "short" || value === "medium" || value === "long" || value === "epic" ? value : "medium";
}

function readTargetTotalWords(value: unknown) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return 500000;
  }

  return Math.min(5000000, Math.max(50000, Math.round(numberValue * 10000)));
}

function readTargetReader(value: unknown): TargetReader {
  return readerOptions.includes(value as TargetReader) ? value as TargetReader : "男频";
}

function readOptionalTargetReader(value: unknown): TargetReader | "" {
  return readerOptions.includes(value as TargetReader) ? value as TargetReader : "";
}

function readCategoryDescription(input: {
  targetReader: TargetReader;
  genre: string;
  tagTaxonomyStyle: "fanqie" | "qidian";
  categoryDescription?: string;
}) {
  const explicitDescription = String(input.categoryDescription ?? "").trim();

  if (explicitDescription) {
    return explicitDescription;
  }

  if (input.tagTaxonomyStyle === "qidian") {
    return qidianTaxonomyByReader[input.targetReader].find((category) => category.name === input.genre)?.description ?? "";
  }

  return novelTaxonomy[input.targetReader].mainCategories.find((category) => category.name === input.genre)?.description ?? "";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const rawAction = String(body.action ?? "");
  const action =
    rawAction === "protagonists" ||
    rawAction === "description" ||
    rawAction === "titles" ||
    rawAction === "titleConcept" ||
    rawAction === "storyDesign"
      ? rawAction
      : "titles";
  const titleConcept = String(body.titleConcept ?? "");
  const explicitTargetReader = readOptionalTargetReader(body.targetReader);
  const targetReader = action === "storyDesign" ? explicitTargetReader : readTargetReader(body.targetReader);
  const tagTaxonomyStyle = body.tagTaxonomyStyle === "qidian" ? "qidian" : "fanqie";
  const genre = String(body.genre ?? "");

  try {
    const result = await assistProjectCreation({
      action,
      name: action === "titles" && titleConcept.trim() ? "" : String(body.name ?? ""),
      storyIdea: String(body.storyIdea ?? ""),
      titleConcept,
      genre,
      categoryDescription: targetReader
        ? readCategoryDescription({
            targetReader,
            genre,
            tagTaxonomyStyle,
            categoryDescription: String(body.categoryDescription ?? "")
          })
        : "",
      targetReader,
      tags: list(body.tags),
      protagonistNames: list(body.protagonistNames),
      protagonistCharacters: characterList(body.protagonistCharacters, targetReader),
      coreSellingPoint: String(body.coreSellingPoint ?? ""),
      goldenFinger: String(body.goldenFinger ?? ""),
      openingHook: String(body.openingHook ?? ""),
      workLengthType: readWorkLengthType(body.workLengthType),
      targetTotalWords: readTargetTotalWords(body.targetTotalWords),
      description: String(body.description ?? ""),
      descriptionAssistMode: body.descriptionAssistMode === "polish" ? "polish" : "generate",
      titleNamingStyle: body.titleNamingStyle === "qidian" ? "qidian" : "fanqie",
      tagTaxonomyStyle,
      descriptionWritingStyle: body.descriptionWritingStyle === "qidian" ? "qidian" : "fanqie",
      avoidTitles: list(body.avoidTitles)
    });

    return Response.json({ result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "AI 辅助生成失败" },
      { status: 400 }
    );
  }
}
