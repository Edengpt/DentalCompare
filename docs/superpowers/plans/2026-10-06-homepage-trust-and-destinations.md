# Homepage: shorter destinations grid + "Why you can trust this" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse "Verified clinics by country" to 3 rows (8 countries) with an in-place "show all / show fewer" toggle, and add a 4-card trust section after the example comparison (replacing the comparison's own "every clinic is checked" box).

**Architecture:** A pure `splitDestinations()` decides what is shown/hidden; the existing client `Destinations` component renders it with a toggle that hides (not removes) the extra tiles. A new server component `Trust` renders 4 cards from a new `trust` dictionary key. `ExampleComparison` loses its `verifiedPromise` prop.

**Tech Stack:** Next.js 16 (App Router, `src/app/[locale]`), React, Tailwind v4, lucide-react icons, vitest (node env, `*.test.ts` only), 7 dictionaries in `src/i18n/dictionaries/` (`he.ts` is the source type; others are `typeof he`).

**Spec:** `docs/superpowers/specs/2026-10-06-homepage-trust-and-destinations-design.md`

## Global Constraints

- Every claim in the trust cards must be true of the system today. Card 2 must say the clinic is *asked* for its warranty — the warranty field is optional, never "every quote includes".
- No invented numbers anywhere.
- Default visible destinations: 2 wide + 6 = **8**, same at every width. No toggle when there are ≤ 8.
- Collapsed tiles stay in the HTML with the `hidden` attribute (SEO); never removed from the DOM.
- Toggle button has `aria-expanded` and `aria-controls` pointing at the list it controls.
- "Show fewer" scrolls back to the top of the destinations section.
- All new copy in all 7 dictionaries: en, he, ru, fr, de, zh, tr. No blank strings.
- Read the relevant guide in `node_modules/next/dist/docs/` before writing framework code (repo rule, `AGENTS.md`).
- Do not reformat unrelated lines (several dictionaries are not Prettier-clean on main; run Prettier only on files you create).

## Review Focus

- **Exactly 8 countries** — expected: all 8 shown, no toggle (test in Task 1).
- **9 countries** — expected: 8 shown, 1 hidden, toggle present (test in Task 1).
- **Only 1 active country** — expected: one wide tile, no second wide slot, no toggle, no crash (test in Task 1).
- **Keyboard user on collapsed grid** — hidden tiles must not be focusable; `hidden` attribute guarantees this (checked in Task 2 visual step with Tab).
- **Hebrew (RTL)** — toggle and cards align to the start edge; check in the Task 5 visual step.

---

### Task 1: Pure split of the destinations list

**Files:**
- Create: `src/lib/split-destinations.ts`
- Test: `src/lib/split-destinations.test.ts`

**Interfaces:**
- Produces: `splitDestinations<T>(items: T[], visible?: number): { wide: T[]; shown: T[]; hidden: T[]; hasMore: boolean }` — `wide` = first up to 2 items; `shown` = the next `visible - 2` items (default `visible` = 8, so 6); `hidden` = the rest; `hasMore` = `hidden.length > 0`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { splitDestinations } from "./split-destinations";

const list = (n: number) => Array.from({ length: n }, (_, i) => `c${i + 1}`);

describe("splitDestinations", () => {
  it("returns nothing for an empty list", () => {
    expect(splitDestinations([])).toEqual({ wide: [], shown: [], hidden: [], hasMore: false });
  });

  it("puts a single country in the wide row and offers no toggle", () => {
    expect(splitDestinations(list(1))).toEqual({
      wide: ["c1"],
      shown: [],
      hidden: [],
      hasMore: false,
    });
  });

  it("shows exactly 8 without a toggle", () => {
    const r = splitDestinations(list(8));
    expect(r.wide).toEqual(["c1", "c2"]);
    expect(r.shown).toEqual(["c3", "c4", "c5", "c6", "c7", "c8"]);
    expect(r.hidden).toEqual([]);
    expect(r.hasMore).toBe(false);
  });

  it("hides the ninth and offers the toggle", () => {
    const r = splitDestinations(list(9));
    expect(r.shown).toHaveLength(6);
    expect(r.hidden).toEqual(["c9"]);
    expect(r.hasMore).toBe(true);
  });

  it("keeps order and hides 20 of 28", () => {
    const r = splitDestinations(list(28));
    expect([...r.wide, ...r.shown, ...r.hidden]).toEqual(list(28));
    expect(r.hidden).toHaveLength(20);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/split-destinations.test.ts`
Expected: FAIL — cannot resolve `./split-destinations`.

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * How the homepage lays out its destination tiles: the first two get the wide
 * row, the next few fill the rows below, and anything past `visible` waits
 * behind "Show all". Order is preserved; busiest countries come first.
 */
export function splitDestinations<T>(items: T[], visible = 8) {
  const wide = items.slice(0, 2);
  const shown = items.slice(2, Math.max(2, visible));
  const hidden = items.slice(Math.max(2, visible));
  return { wide, shown, hidden, hasMore: hidden.length > 0 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/split-destinations.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/split-destinations.ts src/lib/split-destinations.test.ts
git commit -m "feat: split homepage destinations into shown and hidden"
```

---

### Task 2: Collapsible destinations grid

**Files:**
- Modify: `src/components/sections/destinations.tsx` (props + render at the end of the component, currently lines ~96–108)
- Modify: `src/app/[locale]/page.tsx` (`<Destinations …>` props)
- Modify: `src/i18n/dictionaries/{he,en,ru,fr,de,zh,tr}.ts` (`destinations` block: add `showAll`, `showLess`)

**Interfaces:**
- Consumes: `splitDestinations` from Task 1.
- Produces: `Destinations` gains props `showAllLabel: string` (already formatted with the count) and `showLessLabel: string`.

- [ ] **Step 1: Add dictionary keys** — inside each file's `destinations: { … }`, after `joiningSoon`:

| file | `showAll` | `showLess` |
|---|---|---|
| he | `"הצג את כל {count} המדינות"` | `"הצג פחות"` |
| en | `"Show all {count} countries"` | `"Show fewer"` |
| ru | `"Показать все страны ({count})"` | `"Свернуть"` |
| fr | `"Voir les {count} pays"` | `"Voir moins"` |
| de | `"Alle Länder anzeigen ({count})"` | `"Weniger anzeigen"` |
| zh | `"显示全部 {count} 个国家"` | `"收起"` |
| tr | `"Tüm ülkeleri göster ({count})"` | `"Daha az göster"` |

- [ ] **Step 2: Run dictionary tests**

Run: `npx vitest run src/i18n`
Expected: all pass (completeness + no blanks).

- [ ] **Step 3: Rewrite the render in `destinations.tsx`**

Add imports: `import { useId, useRef, useState } from "react";` and `import { splitDestinations } from "@/lib/split-destinations";`. Add props `showAllLabel`, `showLessLabel` to the signature/type. Replace `const [first, second, ...rest] = destinations; const wide = [first, second].filter(Boolean);` with:

```tsx
  const [expanded, setExpanded] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const listId = useId();
  const { wide, shown, hidden, hasMore } = splitDestinations(destinations);
```

(Hooks must sit **above** the `if (destinations.length === 0) return null;` early return — move that return below them.)

Change `tile()` so it can render a collapsed tile: signature `(d: DestinationTile, big: boolean, index: number, hiddenTile = false)`, and its outer element becomes `<li key={d.code} className="relative" hidden={hiddenTile}>`. (`hidden` keeps the tile in the HTML for search engines and takes it out of the tab order.)

Then replace the returned JSX with:

```tsx
    <section ref={sectionRef} className="scroll-mt-20 py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <h2 className="font-display text-foreground text-2xl font-bold sm:text-3xl">{title}</h2>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">{subtitle}</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">{wide.map((d, i) => tile(d, true, i))}</ul>
        {shown.length > 0 && (
          <ul id={listId} className="mt-4 grid gap-4 sm:grid-cols-3">
            {shown.map((d, i) => tile(d, false, i + 2))}
            {hidden.map((d, i) => tile(d, false, i + 2 + shown.length, !expanded))}
          </ul>
        )}
        {hasMore && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => {
              if (expanded) sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              setExpanded(!expanded);
            }}
            className="border-border text-teal-deep hover:bg-sand mt-6 rounded-md border px-4 py-2 text-sm font-semibold"
          >
            {expanded ? showLessLabel : showAllLabel}
          </button>
        )}
      </div>
    </section>
```

- [ ] **Step 4: Wire the labels in `page.tsx`**

```tsx
          <Destinations
            title={t.destinations.title}
            subtitle={t.destinations.subtitle}
            showAllLabel={format(t.destinations.showAll, { count: tiles.length })}
            showLessLabel={t.destinations.showLess}
            destinations={tiles}
          />
```

Add `format` to the existing import: `import { format, plural } from "@/i18n/format";`.

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit -p . && npx eslint src/components/sections/destinations.tsx "src/app/[locale]/page.tsx"`
Expected: no output / no errors.

- [ ] **Step 6: Visual check** — with the dev server running (`npm run dev`, local DB up), open `http://localhost:3000/en`: 8 tiles + "Show all N countries"; click → all shown, label "Show fewer"; click → collapses and scrolls to the section top. Press Tab through the collapsed grid: focus never lands on a hidden tile.

- [ ] **Step 7: Commit**

```bash
git add src/components/sections/destinations.tsx "src/app/[locale]/page.tsx" src/i18n/dictionaries/*.ts
git commit -m "feat: collapse homepage destinations to three rows with show all"
```

---

### Task 3: "Why you can trust this" section

**Files:**
- Create: `src/components/sections/trust.tsx`
- Modify: `src/i18n/dictionaries/{he,en,ru,fr,de,zh,tr}.ts` (new top-level `trust` block, placed right after `exampleComparison`)
- Modify: `src/app/[locale]/page.tsx` (render `<Trust t={t.trust} />` between `ExampleComparison` and `Faq`)

**Interfaces:**
- Produces: `Trust({ t }: { t: Dictionary["trust"] })`. Dictionary shape: `{ title, subtitle, checkedTitle, checkedBody, warrantyTitle, warrantyBody, neutralTitle, neutralBody, filesTitle, filesBody }` (all strings).

- [ ] **Step 1: Add the `trust` block to every dictionary**

he:
```ts
  trust: {
    title: "למה אפשר לסמוך על זה",
    subtitle: "ארבעה דברים שבנינו כדי שתוכלו לבחור מרפאה בחו״ל בלי לקחת סיכון מיותר.",
    checkedTitle: "כל מרפאה נבדקת",
    checkedBody: "המרפאה מעלה רישיון עיסוק, ואדם מהצוות בודק אותו לפני שהיא מופיעה. מרפאה שלא נבדקה לא מגיעה אליכם.",
    warrantyTitle: "אחריות כתובה מראש",
    warrantyBody: "טופס ההצעה מבקש מכל מרפאה את שנות האחריות ומה היא עושה אם משהו נכשל אחרי שחזרתם הביתה, כך שאתם רואים את זה לפני שבוחרים.",
    neutralTitle: "חינם וניטרלי",
    neutralBody: "המרפאות משלמות מנוי קבוע, לא עמלה על מטופל, כך שאין לנו סיבה לדחוף מרפאה מסוימת.",
    filesTitle: "הקבצים שלכם מוגנים",
    filesBody: "הרנטגן ותוכנית הטיפול נשמרים באחסון פרטי ונשלחים רק למרפאות שבחרתם.",
  },
```

en:
```ts
  trust: {
    title: "Why you can trust this",
    subtitle: "Four things we built so you can choose a clinic abroad without taking a needless risk.",
    checkedTitle: "Every clinic is checked",
    checkedBody: "A clinic uploads its licence to practise, and a person on our team checks it before the clinic appears. A clinic that wasn't checked never reaches you.",
    warrantyTitle: "Warranty in writing, up front",
    warrantyBody: "The quote form asks every clinic for its warranty and what it does if something fails after you fly home, so you see it before you choose.",
    neutralTitle: "Free and neutral",
    neutralBody: "Clinics pay a flat subscription, not a fee per patient, so we have no reason to push any clinic.",
    filesTitle: "Your files stay private",
    filesBody: "Your x-ray and treatment plan are kept in private storage and sent only to the clinics you choose.",
  },
```

ru:
```ts
  trust: {
    title: "Почему этому можно доверять",
    subtitle: "Четыре вещи, которые мы сделали, чтобы вы могли выбрать клинику за рубежом без лишнего риска.",
    checkedTitle: "Каждая клиника проверена",
    checkedBody: "Клиника загружает лицензию на практику, и сотрудник нашей команды проверяет её до того, как клиника появится на сайте. Непроверенная клиника до вас не дойдёт.",
    warrantyTitle: "Гарантия письменно и заранее",
    warrantyBody: "Форма предложения просит каждую клинику указать гарантию и что она сделает, если что-то пойдёт не так после вашего возвращения домой, — вы видите это до выбора.",
    neutralTitle: "Бесплатно и беспристрастно",
    neutralBody: "Клиники платят фиксированную подписку, а не комиссию за пациента, поэтому у нас нет причин продвигать какую-либо клинику.",
    filesTitle: "Ваши файлы защищены",
    filesBody: "Рентген и план лечения хранятся в закрытом хранилище и отправляются только выбранным вами клиникам.",
  },
```

fr:
```ts
  trust: {
    title: "Pourquoi vous pouvez nous faire confiance",
    subtitle: "Quatre choses que nous avons construites pour que vous choisissiez une clinique à l'étranger sans risque inutile.",
    checkedTitle: "Chaque clinique est vérifiée",
    checkedBody: "La clinique dépose son autorisation d'exercer, et une personne de notre équipe la vérifie avant que la clinique n'apparaisse. Une clinique non vérifiée ne vous parvient jamais.",
    warrantyTitle: "Une garantie écrite, dès le départ",
    warrantyBody: "Le formulaire de devis demande à chaque clinique sa garantie et ce qu'elle fait si un problème survient après votre retour, pour que vous le voyiez avant de choisir.",
    neutralTitle: "Gratuit et neutre",
    neutralBody: "Les cliniques paient un abonnement fixe, pas une commission par patient : nous n'avons aucune raison de favoriser une clinique.",
    filesTitle: "Vos fichiers restent privés",
    filesBody: "Votre radio et votre plan de traitement sont conservés dans un stockage privé et envoyés uniquement aux cliniques que vous choisissez.",
  },
```

de:
```ts
  trust: {
    title: "Warum Sie uns vertrauen können",
    subtitle: "Vier Dinge, die wir gebaut haben, damit Sie eine Klinik im Ausland ohne unnötiges Risiko wählen können.",
    checkedTitle: "Jede Klinik wird geprüft",
    checkedBody: "Die Klinik lädt ihre Berufszulassung hoch, und ein Mitglied unseres Teams prüft sie, bevor die Klinik erscheint. Eine ungeprüfte Klinik erreicht Sie nie.",
    warrantyTitle: "Gewährleistung schriftlich, vorab",
    warrantyBody: "Das Angebotsformular fragt jede Klinik nach ihrer Gewährleistung und danach, was sie tut, wenn nach Ihrer Heimreise etwas schiefgeht – so sehen Sie es vor der Wahl.",
    neutralTitle: "Kostenlos und neutral",
    neutralBody: "Kliniken zahlen ein festes Abonnement, keine Gebühr pro Patient – wir haben also keinen Grund, eine bestimmte Klinik zu bevorzugen.",
    filesTitle: "Ihre Dateien bleiben privat",
    filesBody: "Ihr Röntgenbild und Ihr Behandlungsplan werden privat gespeichert und nur an die Kliniken gesendet, die Sie auswählen.",
  },
```

zh:
```ts
  trust: {
    title: "为什么可以信任我们",
    subtitle: "我们做了四件事，让您在国外选择诊所时不必承担不必要的风险。",
    checkedTitle: "每家诊所都经过核查",
    checkedBody: "诊所上传执业许可证，由我们团队的工作人员核查后才会显示。未经核查的诊所不会出现在您面前。",
    warrantyTitle: "事先书面写明保修",
    warrantyBody: "报价表会询问每家诊所的保修期，以及您回国后出现问题时诊所会如何处理，让您在选择之前就能看到。",
    neutralTitle: "免费且中立",
    neutralBody: "诊所支付固定订阅费，而不是按患者收费，所以我们没有理由偏向任何一家诊所。",
    filesTitle: "您的文件受到保护",
    filesBody: "您的X光片和治疗方案保存在私密存储中，只发送给您选择的诊所。",
  },
```

tr:
```ts
  trust: {
    title: "Neden güvenebilirsiniz",
    subtitle: "Yurt dışında gereksiz risk almadan klinik seçebilmeniz için kurduğumuz dört şey.",
    checkedTitle: "Her klinik kontrol edilir",
    checkedBody: "Klinik çalışma ruhsatını yükler ve ekibimizden biri, klinik görünmeden önce onu kontrol eder. Kontrol edilmemiş bir klinik size asla ulaşmaz.",
    warrantyTitle: "Garanti baştan yazılı",
    warrantyBody: "Teklif formu her kliniğe garantisini ve eve döndükten sonra bir sorun çıkarsa ne yapacağını sorar; böylece seçmeden önce görürsünüz.",
    neutralTitle: "Ücretsiz ve tarafsız",
    neutralBody: "Klinikler hasta başına ücret değil, sabit bir abonelik öder; bu yüzden herhangi bir kliniği öne çıkarmak için bir nedenimiz yok.",
    filesTitle: "Dosyalarınız gizli kalır",
    filesBody: "Röntgeniniz ve tedavi planınız özel depolamada tutulur ve yalnızca seçtiğiniz kliniklere gönderilir.",
  },
```

- [ ] **Step 2: Run dictionary tests**

Run: `npx vitest run src/i18n`
Expected: all pass.

- [ ] **Step 3: Create `src/components/sections/trust.tsx`**

```tsx
import { FileLock2, Scale, ShieldCheck, Undo2 } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";

/**
 * Four answers to "but can I trust this?", each one true of the system as it
 * stands: licence checks gate the directory, the quote form asks for the
 * warranty, revenue is a flat clinic subscription, and medical files sit in
 * private storage. No numbers, no reviews — there are none to show yet.
 */
export function Trust({ t }: { t: Dictionary["trust"] }) {
  const cards = [
    { Icon: ShieldCheck, title: t.checkedTitle, body: t.checkedBody },
    { Icon: Undo2, title: t.warrantyTitle, body: t.warrantyBody },
    { Icon: Scale, title: t.neutralTitle, body: t.neutralBody },
    { Icon: FileLock2, title: t.filesTitle, body: t.filesBody },
  ];

  return (
    <section className="py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <h2 className="font-display text-foreground text-2xl font-bold sm:text-3xl">{t.title}</h2>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">{t.subtitle}</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ Icon, title, body }) => (
            <li key={title} className="border-border bg-card rounded-lg border p-5">
              <span className="bg-coral-soft text-teal-deep grid h-10 w-10 place-items-center rounded-md">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="font-display text-foreground mt-4 text-base font-bold">{title}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

Before relying on the icon names, confirm they exist: `node -e "const l=require('lucide-react'); console.log(['FileLock2','Scale','ShieldCheck','Undo2'].map(n=>n+':'+!!l[n]).join(' '))"`. If one is missing, substitute `Lock` for `FileLock2` or `RotateCcw` for `Undo2`.

- [ ] **Step 4: Render it in `page.tsx`** — add `import { Trust } from "@/components/sections/trust";` and place `<Trust t={t.trust} />` immediately after the `</ExampleComparison>` element and before `<Faq t={t.faq} />`.

- [ ] **Step 5: Typecheck, lint, format the new file**

Run: `npx tsc --noEmit -p . && npx eslint src/components/sections/trust.tsx "src/app/[locale]/page.tsx" && npx prettier --write src/components/sections/trust.tsx`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/trust.tsx "src/app/[locale]/page.tsx" src/i18n/dictionaries/*.ts
git commit -m "feat: add 'why you can trust this' section to the homepage"
```

---

### Task 4: Remove the duplicate "every clinic is checked" box

**Files:**
- Modify: `src/components/sections/example-comparison.tsx` (prop `verifiedPromise`, the `bg-sand mt-8` block at the end, and `ShieldCheck` import if now unused)
- Modify: `src/app/[locale]/page.tsx` (drop the `verifiedPromise={…}` prop)
- Modify: `src/i18n/dictionaries/{he,en,ru,fr,de,zh,tr}.ts` (delete `howItWorks.verifiedTitle` and `howItWorks.verifiedPromise`)

- [ ] **Step 1: Confirm there is no other use**

Run: `grep -rn "verifiedTitle\|verifiedPromise" src --include=*.ts --include=*.tsx | grep -v dictionaries`
Expected: only `page.tsx` and `example-comparison.tsx`.

- [ ] **Step 2: Edit `example-comparison.tsx`** — remove `verifiedPromise` from the destructured props and the props type; delete the comment `{/* The verified badge appears on every clinic … */}` and the `<div className="bg-sand mt-8 …">…</div>` block after the table; remove `ShieldCheck` from the `lucide-react` import if it is no longer referenced in the file.

- [ ] **Step 3: Edit `page.tsx`** — `<ExampleComparison t={t.exampleComparison} locale={locale} />`.

- [ ] **Step 4: Delete the two keys from all 7 dictionaries** (each is `verifiedTitle: "…",` and a two-line `verifiedPromise:` entry inside `howItWorks`).

- [ ] **Step 5: Typecheck and tests**

Run: `npx tsc --noEmit -p . && npx vitest run src/i18n`
Expected: no type errors; dictionary tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/sections/example-comparison.tsx "src/app/[locale]/page.tsx" src/i18n/dictionaries/*.ts
git commit -m "refactor: move the verified-clinic promise into the trust section"
```

---

### Task 5: Full verification and PR

- [ ] **Step 1: Full test suite** — `npx vitest run` (local Postgres must be up: `docker start dentalcompare-db`). Expected: all files pass.
- [ ] **Step 2: Visual check** — headless Chrome screenshots of `/en` and `/he` at 1440×900 and 390×844: page order (Hero → How it works → Popular treatments → Destinations → Example comparison → Trust → FAQ), 8 destination tiles + toggle, trust cards 4/2/1 per row, RTL alignment in `he`.
- [ ] **Step 3: Push and open a PR** — `git push -u origin feat/homepage-trust-section`, then `gh pr create --base main` with a summary of both changes, the test count, and the screenshots' findings.
