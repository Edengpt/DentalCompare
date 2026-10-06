import type { FileValidationError } from "@/lib/storage";
import { REQUEST_LIMITS } from "@/lib/constants";
import { LOGO_MAX_FILE_SIZE_MB } from "@/lib/storage";
import type { Dictionary } from "./get-dictionary";
import { format } from "./format";

/**
 * Turns a storage validation code into a message in the reader's language.
 *
 * Shared by the client dropzone and the upload API routes so the two can't
 * drift into saying different things about the same rejected file.
 */
export function fileValidationMessage(
  t: Dictionary["validation"],
  err: FileValidationError,
  /** The limit that was broken, when it isn't the patient-upload one. */
  mb: number = REQUEST_LIMITS.maxFileSizeMB,
): string {
  return err === "TYPE" ? t.fileType : format(t.fileSize, { mb });
}

export function logoValidationMessage(
  t: Dictionary["validation"],
  err: FileValidationError,
): string {
  return err === "TYPE" ? t.logoType : format(t.logoSize, { mb: LOGO_MAX_FILE_SIZE_MB });
}
