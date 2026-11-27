import { expect, test } from "@playwright/test";
import smartblocksMenuStyles from "../src/smartblocksMenuStyles";

// The bundled Chromium predates contrast-color(); exercise the current browser.
test.use({ channel: "chrome" });

test("the picker follows the host menu palette when its portal has no Blueprint dark ancestor", async ({
  page,
}) => {
  await page.setContent(`
    <div class="bp3-portal">
      <div class="roamjs-smartblocks-picker">
        <div class="roamjs-smartblocks-menu-row is-active">
          <button class="roamjs-smartblocks-workflow"><span class="bp3-text-overflow-ellipsis">Selected workflow</span></button>
        </div>
        <div class="roamjs-smartblocks-menu-row">
          <button class="roamjs-smartblocks-workflow"><span class="bp3-text-overflow-ellipsis">Other workflow</span></button>
        </div>
        <div class="roamjs-smartblocks-preview-title">Preview</div>
        <footer class="roamjs-smartblocks-footer">Run</footer>
      </div>
    </div>`);
  await page.addStyleTag({ content: smartblocksMenuStyles });
  const picker = page.locator(".roamjs-smartblocks-picker");
  await expect(picker).toHaveCSS("background-color", "rgb(255, 255, 255)");
  const palette = await page.addStyleTag({
    content: `:root {
      --bc-menu: #fafafa;
      --co-menu__item: #222222;
      --bc-popover: #292929;
      --bc-menu__item--active: #404040;
      --co-menu__item--active: #ffffff;
    }
    button { color: var(--co-button__minimal); }`,
  });
  await expect(picker).toHaveCSS("background-color", "rgb(250, 250, 250)");
  await expect(picker).toHaveCSS("color", "rgb(34, 34, 34)");
  await expect(picker.locator(".is-active")).toHaveCSS(
    "background-color",
    "rgb(64, 64, 64)",
  );
  await expect(picker.locator(".roamjs-smartblocks-preview-title")).toHaveCSS(
    "color",
    "rgb(34, 34, 34)",
  );
  await expect(picker.locator("footer")).toHaveCSS(
    "background-color",
    "rgb(41, 41, 41)",
  );
  await expect(picker.getByText("Selected workflow")).toHaveCSS(
    "color",
    "rgb(255, 255, 255)",
  );
  await expect(picker.getByText("Other workflow")).toHaveCSS(
    "color",
    "rgb(34, 34, 34)",
  );
  await palette.evaluate((element) => element.remove());
  await expect(picker).toHaveCSS("background-color", "rgb(255, 255, 255)");
});

test("legacy menu background tokens supply readable labels for low-contrast accents", async ({
  page,
}) => {
  await page.setContent(`
    <style>:root { --rm-menu__background: #333; --rm-menu__color: #cc66ff; }</style>
    <div class="roamjs-smartblocks-picker"><button class="roamjs-smartblocks-workflow">
      <span class="bp3-text-overflow-ellipsis">Workflow</span>
    </button></div>`);
  await page.addStyleTag({ content: smartblocksMenuStyles });
  await expect(page.locator("button span")).toHaveCSS("color", "rgb(255, 255, 255)");
});

test("Dark Age buttons show the row surface and retain the active footer highlight", async ({
  page,
}) => {
  await page.setContent(`
    <body class="darkage"><div class="bp3-popover-content"><div class="roamjs-smartblocks-picker">
      <div class="roamjs-smartblocks-menu-row"><button class="bp3-button roamjs-smartblocks-workflow">Flow</button></div>
      <footer class="roamjs-smartblocks-footer"><button class="bp3-button">Run</button>
        <button class="bp3-button" aria-pressed="true">Pin</button></footer>
    </div></div></body>`);
  await page.addStyleTag({ content: smartblocksMenuStyles });
  await page.addStyleTag({
    content: `.darkage { --dropdown-menu-highlight: #3e3d3d; }
      .darkage .bp3-popover-content .bp3-button { background: #ffffff82 !important; }`,
  });
  const buttons = page.locator("button");
  await expect(buttons.nth(0)).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(buttons.nth(1)).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(buttons.nth(2)).toHaveCSS("background-color", "rgb(62, 61, 61)");
});

test("the picker follows a starter palette and returns to its default when disabled", async ({ page }) => {
  await page.setContent(`
    <div class="roamjs-smartblocks-picker">
      <div class="roamjs-smartblocks-menu-row is-active"><button class="roamjs-smartblocks-workflow"><span class="bp3-text-overflow-ellipsis">Workflow</span></button></div>
      <div class="roamjs-smartblocks-preview"><span class="roamjs-smartblocks-preview-title">Preview</span></div>
      <footer class="roamjs-smartblocks-footer">Run</footer>
    </div>`);
  await page.addStyleTag({ content: smartblocksMenuStyles });
  const picker = page.locator(".roamjs-smartblocks-picker");
  const theme = await page.addStyleTag({ content: `:root {
    --theme-surface: #281e40; --theme-text: #efe9fb; --theme-control-active: #48376e;
    --theme-bg-soft: #1e1631; --theme-text-muted: #b3a6cf;
  }` });
  await expect(picker).toHaveCSS("background-color", "rgb(40, 30, 64)");
  await expect(picker.locator("button span")).toHaveCSS("color", "rgb(239, 233, 251)");
  await expect(picker.locator(".is-active")).toHaveCSS("background-color", "rgb(72, 55, 110)");
  await expect(picker.locator(".roamjs-smartblocks-preview-title")).toHaveCSS("color", "rgb(179, 166, 207)");
  await expect(picker.locator("footer")).toHaveCSS("background-color", "rgb(30, 22, 49)");
  await theme.evaluate((el) => el.remove());
  await expect(picker).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(picker.locator("footer")).toHaveCSS("background-color", "rgb(235, 236, 235)");
});
