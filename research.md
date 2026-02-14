# SmartBlocks Multi-Issue Research

Date: 2026-02-14
Scope: #54, #71, #119, #128, #130, #142, #143

## Issue #54
Link: https://github.com/RoamJS/smartblocks/issues/54

- Confirmed bug in `BLOCKMENTIONSDATED` for:
1. `first of this month` parsing.
2. date args containing commas (e.g. `[[January 24th, 2023]]`, `February 1, 2023`).
- Loom reviewed and transcribed where audio existed.
- Root cause: argument splitter broke on commas; NLP parser treated `first of ...` inconsistently.
- Decision: fixed in this branch via `splitSmartBlockArgs` + `parseBlockMentionsDatedArg`.

## Issue #71
Link: https://github.com/RoamJS/smartblocks/issues/71

- Feature request, not a regression bug: stream SmartBlock output progressively.
- Existing behavior writes final block output in one shot in `sbBomb`.
- Loom had little/no useful audio transcript; visual behavior aligns with request.
- Decision: implement opt-in stream mode in this repo (settings + `sbBomb` behavior).

## Issue #119
Link: https://github.com/RoamJS/smartblocks/issues/119

- Functionality already exists using `BREADCRUMBS`:
  - `<%BREADCRUMBS:+((uid))%>` returns page title without breadcrumb chain.
- Gap is discoverability/docs rather than missing capability.
- Decision: update `BREADCRUMBS` help text to document `+` / `-` behavior.

## Issue #128
Link: https://github.com/RoamJS/smartblocks/issues/128

- Repro is input-method dependent in `%FORM%` workflows (enter/click/esc matrix).
- Loom evidence reviewed; many clips are no-audio.
- Root cause hypothesis: focus/input leakage around modal interaction, especially when triggered by keyboard.
- Decision: enforce modal focus in `%FORM%` invocation (`enforceFocus: true`) to stabilize keyboard flow.

## Issue #130
Link: https://github.com/RoamJS/smartblocks/issues/130

- Same surface area as #128 (`%FORM%` dialog keyboard semantics).
- Maintainer linked underlying dependency issue in `roamjs-components`.
- This repo can still mitigate behavior by forcing dialog focus.
- Decision: same local mitigation as #128 (`enforceFocus: true`).

## Issue #142
Link: https://github.com/RoamJS/smartblocks/issues/142

- Repro confirmed: “Add Hot Key” does not add when existing key is `control+o`.
- Root cause: Add path always appends `control+o`, but state is object-map; duplicate key overwrites existing entry.
- Decision: generate first available default hotkey and use functional state updates for add/edit/delete.

## Issue #143
Link: https://github.com/RoamJS/smartblocks/issues/143

- Repro was about `<%CURSOR%>` breaking command palette/hotkeys on DNP.
- Already fixed upstream in this repo main branch via window-id handling (PR #145 / commit `c1b7d43840188cbe7020434ff37f349cdc6326e3`).
- Decision: no additional code changes needed in this branch beyond staying current with `main`.
