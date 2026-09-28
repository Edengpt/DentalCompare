# Product documents

The product, planning and business materials that until 2026-09-28 lived only in OneDrive, next to the code rather than inside it. They're in the repository now so they have version history and a backup.

> **Note:** these are working documents from along the way (June–September 2026), and the early ones describe decisions that have since changed. For example, `Spec.md` (June) talks about choosing up to 10 clinics and Stripe payment, and `OPUS_EXECUTION_PLAN.md` (July) about a one-off patient fee, while the August PRD already matches today: up to 3 clinics, and free for the patient. For **what exists today**, the source of truth is the code and `docs/HANDOFF.md`.

## `prd/` — specification and planning

| File | What it is | Date |
|---|---|---|
| `Spec.md` | The first system specification | June 2026 |
| `PRD-source.docx` | The original PRD in Word (the source for the Markdown files) | June 2026 |
| `OPUS_EXECUTION_PLAN.md` | Execution plan for building the MVP | July 2026 |
| `PRD_main.md` | The PRD, condensed version | August 2026 |
| `PRD_full.md` | The PRD, full version | August 2026 |

## `flows/` — flowcharts

The patient flow and the clinic flow. Each chart exists in three formats: `.mmd` is the Mermaid source (edit this one), and `.png` / `.pdf` are exports from it.

## `business/` — business materials

| File | What it is |
|---|---|
| `מדריך_שימוש_DentalCompare.pdf` | Site user guide |
| `מחשבון_רווחיות_DentalCompare.xlsx` | Profitability calculator |
| `מייל_פנייה_למרפאות.txt` | Outreach email template for clinics |

## `tools/`

`extract-docx-to-md.py` converts a Word document into Markdown, keeping headings. This is how the PRD files were produced from `PRD-source.docx`. Requires `python-docx`.

## Not in the repository (on purpose)

- **The `.mp4` videos** (`dental clinic.mp4` and others): large binary files that don't belong in git. They stay in OneDrive.
- **`remotion/`**: a separate video project.
