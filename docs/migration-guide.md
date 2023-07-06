This page outlines all the changes made from Roam42 to RoamJS SmartBlocks that are not backwards compatible.

# Javascript Executing Commands

The following commands had a role in executing arbitrary JavaScript and will be removed:

- `JAVASCRIPT`
- `J`
- `JAVASCRIPTASYNC`
- `JA`
- `ONBLOCKEXIT`
- `IF`
- `THEN`
- `ELSE`
- `IFTRUE`

There are suitable workarounds for most of these commands.

- If you are using a SmartBlock workflow in which you are not the original author of that uses these commands, please reach out to the original author and ask how to migrate
  - In some cases, the workflow will be updated and available on the [Store]([[smartblocks/smartblocks_store]])
  - In other cases, the workflow will evolve to becoming its own extension, to be available in Roam's native extension store.
- If you are the original author of a SmartBlock that uses these commands, please refer to our [Developer Docs](070-developer-docs) for information on how to migrate the logic out of these commands.
- If you are still unsure of what needs to be done, please reach out to support@roamjs.com or message the support channel on Slack.
- The first four Javascript commands could be replaced by using the [registerCommand](070-developer-docs#registercommand) API from other extensions or from your personal Roam Graph

# Subcommands

Smartblocks V1 had this notion of "subcommands" - commands that only resolved when paired with a supported command. For example:

- `<%TODOTODAY%> <%PAGE%>`

  Would resolve in a block text that looks like:

- `((block-ref)) [[Name of page with todo block]]`

  This introduced an antipattern of nested command logic residing outside of the commands. In V2, subcommands are now simply formatting options for the output of the parent command. For example, the above should now be written as:

- `<%TODOTODAY:5,(({uid})) {page}%>`

# TODO Commands

Related to the subcommands bullet above, TODO commands used to have the following arguments:

1. Limit
2. Search terms

They now have the following arguments:

1. Limit
2. Format
3. Search terms

# BLOCKMENTIONS Commands

Related to the subcommands bullet above, BLOCKMENTIONS commands now have a formatting argument before the search terms.

# Date Formats

The underlying date formatting library was switched to start using [date-fns](https://date-fns.org/). This means format parameters for `DATE` commands will be using different conventions. Please consult the [formatting docs](https://date-fns.org/v2.23.0/docs/format) to see how to achieve desired behavior.

# JavaScript Commands Return Values

For both async and regular JavaScript commands, you could return any of the following types and it will be handled by the SmartBlocks engine.

- A string - will output the value to a single block
- An array of strings - will output the value to multiple sibling blocks
- An array of Nodes - will output the value to multiple sibling and child blocks
  - A Node is an object with a `text` field of type `string` and a `children` field which maps to an array of Nodes.

# RESOLVEBLOCKREFATEND Removed

Due to [how commands now resolve](020-understanding-commands#command-resolution), `RESOLVEBLOCKREFATEND` is now a redundant command with `RESOLVEBLOCKREF`.

# `REPEAT` Command Changed

The `REPEAT` command now repeats the second argument in the command. So now instead of repeating blocks like this:

- `<%REPEAT:5%>` Repeat Me!

It repeats blocks like this:

- `<%REPEAT:5, Repeat Me!%>`

# `GOTOBLOCK` and `GRAPH` are now parameters.

Related to the sub commands bullet above, the GOTOBLOCK and GRAPH sub commands have been removed in favor of being used as blocks.
`GOTOBLOCK` should simply be specified as the second argument for its two supported commands, like this:

- `<%OPENPAGE:08-27-2021,GOTOBLOCK 2%>`
- `<%SIDEBARWINDOWOPEN:08-27-2021,GOTOBLOCK 2%>`

Similarly, `GRAPH` should be specified as the second argument to its one supported command:

- `<%SIDEBARWINDOWOPEN:08-27-2021,GRAPH%>`

Additionally, `GOTOBLOCK` now supports any numerical value, not just 1 or -1.

# `42Setting` Removed

A goal of creating the SmartBlocks extension was so that it could live independently, absent the original Roam42 extension. This means removing any Roam42 specific functionality. This resulted in the removal of the `42Setting` command.
This command can be replaced using the existing SmartBlocks command set. For example, to replace a block that had this:

- `<%42SETTING:name%>`
- Can be replaced with this block:

- `<%REPLACE:<%REPLACE:<%RESOLVEBLOCKREF:<%BLOCKMENTIONS:1,42Setting,{uid},name%>%>,<%HASHTAG:42Setting%>%>, name %>`

It will be supported when the SmartBlocks extension is in included with the Roam42 bundle.

# `roam42` methods

If you used `JAVASCRIPT` commands that contain `roam42.common` methods, these methods will no longer be available by default with SmartBlocks v2. Here are a list of common Roam42 methods with their mitigation nested under it:

- `roam42.common.createBlock(parent_uid, order, block_string)`

```javascript
const uid = window.roamAlphaAPI.util.generateUID();
window.roamAlphaAPI.createBlock({
  location: { "parent-uid": parent_uid, order },
  block: { string: block_string, uid },
});
return uid;
```

- `roam42.common.createSiblingBlock(fromUID, block_string, bBelow)`

```javascript
const [{ order }, { uid: parent_uid }] = window.roamAlphaAPI.q(`[:find 
(pull ?b [:block/order]) (pull ?p [:block/uid])
:where 
[?b :block/uid "${fromUID}"]
[?p :block/children ?b]
]`)[0];
const uid = window.roamAlphaAPI.util.generateUID();
window.roamAlphaAPI.createBlock({
  location: { "parent-uid": parent_uid, order: order + bBelow },
  block: { string: block_string, uid },
});
return uid;
```

- `roam42.common.moveCursorToNextBlock`
  - This method is pretty hacky and would not recommend using until Roam releases an API for doing this. In any case, if you're still interested, I would look at [the source code directly](https://github.com/dvargas92495/roam42/blob/master/common/commonFunctions.js#L317-L330).
- `roam42.common.moveCursorToPreviousBlock`
  - This method is pretty hacky and would not recommend using until Roam releases an API for doing this. In any case, if you're still interested, I would look at [the source code directly](https://github.com/dvargas92495/roam42/blob/master/common/commonFunctions.js#L332-L344).
- `roam42.common.updateBlock(uid, block_string, open)`

```javascript
window.roamAlphaAPI.updateBlock({
  block: { uid, string: block_string, open },
});
```

- `roam42.settings.get`

  - I would use `SET` and `GET` commands instead. If insistent on using Roam42 Settings, then see [this section](#42setting-removed)

- `roam42.smartBlocks.activeWorkflow.vars[name]`
  - Smartblock Variables are not available by default in `JAVASCRIPT` commands. Simply use the variable `name`.
