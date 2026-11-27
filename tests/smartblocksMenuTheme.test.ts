import { expect, test } from "@playwright/test";
import smartblocksMenuStyles from "../src/smartblocksMenuStyles";

test("the picker follows the host menu palette when its portal has no Blueprint dark ancestor", async ({
  page,
}) => {
  await page.setContent(`
    <div class="bp3-portal">
      <div class="roamjs-smartblocks-picker">
        <div class="roamjs-smartblocks-menu-row is-active"><button>Workflow</button></div>
        <div class="roamjs-smartblocks-preview-title">Preview</div>
        <footer class="roamjs-smartblocks-footer">Run</footer>
      </div>
    </div>`);
  await page.addStyleTag({ content: smartblocksMenuStyles });
  const picker = page.locator(".roamjs-smartblocks-picker");
  await expect(picker).toHaveCSS("background-color", "rgb(255, 255, 255)");
  const palette = await page.addStyleTag({
    content: `:root {
      --bc-menu: #262626;
      --co-menu__item: #e5e5e5;
      --bc-popover: #292929;
      --bc-menu__item--active: #404040;
      --co-menu__item--active: #ffffff;
    }
    button { color: var(--co-button__minimal); }`,
  });
  await expect(picker).toHaveCSS("background-color", "rgb(38, 38, 38)");
  await expect(picker).toHaveCSS("color", "rgb(229, 229, 229)");
  await expect(picker.locator(".is-active")).toHaveCSS(
    "background-color",
    "rgb(64, 64, 64)",
  );
  await expect(picker.locator(".roamjs-smartblocks-preview-title")).toHaveCSS(
    "color",
    "rgb(229, 229, 229)",
  );
  await expect(picker.locator("footer")).toHaveCSS(
    "background-color",
    "rgb(41, 41, 41)",
  );
  await expect(picker.locator("button")).toHaveCSS(
    "color",
    "rgb(255, 255, 255)",
  );
  await palette.evaluate((element) => element.remove());
  await expect(picker).toHaveCSS("background-color", "rgb(255, 255, 255)");
});
