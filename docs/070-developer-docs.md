# Table of Contents

1. [Trigger Your Workflow](010-trigger-your-workflow)
2. [Understanding Commands](020-understanding-commands)
3. [Using Pre-Defined Workflows](030-using-pre-defined-workflows)
4. [Make Your Own Workflows](040-make-your-own-workflows)
5. [Command Reference](050-command-reference)
6. [Alternative Methods](060-alternative-methods)
7. [Developer Docs](070-developer-docs)

# Overview

SmartBlocks exposes a set of functions and objects for interacting with workflows. Roam developers can read from and write to these values from a `roam/js` block or as part of existing RoamJS extensions. This section includes technical notes for JavaScript developers working with SmartBlocks.

All methods below are attached to the `window.roamjs.extensions.smartblocks` object. Be careful before invoking any of them on load, as you will need to wait until the SmartBlocks extension is fully loaded.

## `registerCommand`

This function allows you to create a custom command that users could include in their workflows for specialized functionality. The following example adds the `<%GOOGLECALENDAR%>` command to Smart Blocks:

```javascript
window.roamjs.extension.smartblocks.registerCommand({
  text: "GOOGLECALENDAR",
  handler:
    (context) =>
    (arg1, arg2, ...etc) =>
      [
        "Meeting with RoamJS!",
        arg1, // each argument is a string
        arg2,
      ],
});
```

The parameters are:

1. `text`: the label of the command. Label must be all capital letters
2. `help`: the description of the command, appears when command is selected from autocomplete menu
3. `handler`: a callback method. It takes in a context object and returns a second callback. The second callback takes in a list of string arguments and returns the text or list of texts to be outputted by the command

The context object has the following fields:

- `targetUid` - the target block uid the smart block workflow is outputting to.
- `variables` - the set of variables defined by the workflow so far.

To help with the race condition of which script loads first between SmartBlocks and the one housing your custom command, there is a `registerSmartBlocksCommand` available in the [roam client](https://github.com/RoamJS/roamjs-components/blob/main/src/util/registerSmartBlocksCommand.ts) npm library for those who use node.js to develop extensions.

## `triggerSmartblock`

This function allows you to trigger a SmartBlock workflow defined in the user's graph anywhere in the graph. The following example runs a "Daily" workflow on the Daily Note Page for 10/6/2021:

```javascript
window.roamjs.extension.smartblocks.triggerSmartblock({
  srcName: "Daily",
  targetName: "October 6th, 2021",
});
```

The parameters are:

1. `srcName`: The name of the workflow to trigger. Either this parameter or `srcUid` must be defined.
2. `srcUid`: The block reference of the workflow to trigger. Either this parameter or `srcName` must be defined.
3. `targetName`: The name of the page to trigger the workflow. By default, the workflow is triggered at the bottom of the page. Either this parameter or `targetUid` must be defined.
4. `targetUid`: The block reference of the workflow to trigger. Either this parameter or `targetName` must be defined.
5. `variables`: Any variables to define at the start of the workflow to be accessible by variable-related commands.

The return value is either:

1. `0` if there are no blocks outputted as a result of this SmartBlock
2. `string` representing the uid of the first block of the outputted SmartBlock

## Migrating from JavaScript Commands

On July 4th, 2022, all SmartBlock commands that execute arbitrary Javascript were deprecated as they could pose harm for users from attackers who are looking to circumvent Roam's extension review process.

For workflows that use `IF`, `THEN`, `ELSE`, and `IFTRUE`, commands, they could in most cases could be replace with the various other [IF commands](Command-Reference#logic-control-commands) available, in particular [IFVAR](Command-Reference#ifvar). If you have a use case that cannot be covered by the current conditional command set, feel free to reach out to support@roamjs.com.

For workflows that use the various JavaScript commands (`JAVASCRIPT`, `J`, `JAVASCRIPTASYNC`, `JA`, `ONBLOCKEXIT`), there are various strategies one could turn to, depending on the workflow in question.

The first step is to review [the SmartBlocks Command Reference](Command-Reference). In several cases, you may be writing code replicating features that are already available as a command. For example, this workflow:

```plain text
<%SET:pageName,Quotes%><%NOBLOCKOUTPUT%>
<%JAVASCRIPTASYNC:
var results = await roamAlphaAPI.q(`
  [:find (rand 1 ?t)
   :in $ ?page_title
   :where [?e :node/title ?page_title]
          [?e :block/children ?x]
         [?x :block/string ?t] ] `,
	pageName);
return results[0][0];
%>
```

Could easily be replaced by:

```plain text
<%RANDOMBLOCKFROM:Quotes,1,{text}%>
```

If the logic in your Javascript Command is complex enough that it could not be replaced by preexisting commands, I would then ask whether your workflow would be better served as an extension instead of a SmartBlock workflow. Any workflow that is integrating with some third party service or is manipulating existing data in your graph should probably be its own extension instead of being confined within a templating language. Roam has a command palette accessible from hitting `CMD+p` and adding to this menu with your own functionality is as easy as invoking:

```javascript
window.roamAlphaAPI.ui.commandPalette.addCommand({
  label: "My Command",
  callback: () => console.log("Hello, World!"),
});
```

Extensions could then optionally integrate with SmartBlocks if they want to expose the same features as a SmartBlock command anyway:

```javascript
const callback = () => console.log("Hello, World!");
window.roamAlphaAPI.ui.commandPalette.addCommand({
  label: "My Command",
  callback,
});
window.roamjs.extension.smartblocks.registerCommand({
  text: "MYCOMMAND",
  handler: (context) => callback,
});
```

One thing to keep in mind is that there is a race condition between your extension and the SmartBlocks extension. Meaning, you cannot guarantee the order in which the extensions load. To mitigate this issue, you can listen for when the SmartBlocks extension is loaded:

```javascript
const args = {
  text: "MYCOMMAND",
  handler: (context) => () => console.log("Hello, World"),
};
if (window.roamjs?.extension?.smartblocks) {
  window.roamjs.extension.smartblocks.registerCommand(args);
} else {
  document.body.addEventListener(
    `roamjs:smartblocks:loaded`,
    () =>
      window.roamjs?.extension.smartblocks &&
      window.roamjs.extension.smartblocks.registerCommand(args)
  );
}
```
