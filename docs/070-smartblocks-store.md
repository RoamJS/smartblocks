# Overview

The SmartBlocks Store is a place where users could publish and install SmartBlocks workflow to and from the rest of the Roam community directly from within Roam! To access the store, hit `CMD+P` on mac or `CTRL+P` on windows to open to Roam Command Palette, and search for "Open SmartBlocks Store". Click on the result and the store should appear on the left!

The store will list all the SmartBlocks that are available. Click on one to head to the smart block's details page. From the details page, you could install the SmartBlock directly to your graph and will be taken to the bullet where it is stored. Any SmartBlock in the store that is already installed in your graph will be disabled from visiting or installing again.

# Publishing

You could share SmartBlock workflows with the rest of the Roam Community by publishing to the store!

To publish a given workflow, you will first need your RoamJS token. This token prevents others from publishing workflows with your graph name and prevents others from updating workflows you publish. You could grab a RoamJS token from your user page at https://roamjs.com/user. Then paste it in the modal that appears when you enter "Set RoamJS Token" in the Roam Command Palette.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FmnpNZoFTYr.png?alt=media&token=31625b2c-f18d-4c64-bc5c-2b3efea396ef)

Once you have a token generated, you can now publish any workflow from your graph. To begin, click on the SmartBlock icon that appears next to the `#SmartBlock` tag and click "Publish Workflow".

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2Fv34ut3sUlk.png?alt=media&token=6c950afb-99c2-4735-a18b-bbdeef58a7fc)

Once the workflow has published successfully, it will add a block reference to it to the `roam/js/smartblocks` page.

To edit the metadata of your workflow, copy the block reference to the workflow and paste it anywhere in your graph. Nested under the block reference, create a block for each field you want to configure. Add the value(s) of that field as a child block of the field.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FSuq54hNuCA.png?alt=media&token=8d003cdf-7f31-4909-a930-e78096a7dfe4)

The following metadata fields are supported:

- `Description` - The description of the workflow, shown in the store after a user clicks on it
- `Image` - The thumbnail shown to users associated with your workflow
- `Tags` - Any tags you would like to add to your workflow to make it more easily searchable

To update the workflow itself or any of its metadata, simply click the SmartBlock icon again to publish. If you decide to change the name of the workflow, note that when your users install the workflow it will create a **second** instance of the workflow since it will be under a new name. Be sure to notify your users of a name change if you choose to do so.

# Installing

The SmartBlocks Store lists three tabs:

- Marketplace - This is where you could browse all of the available SmartBlock workflows
- Installed - These are the Smart Block workflows that you have installed from the store to your graph
- Published - These are the Smart Block workflows that you have published to the store

Click on a workflow to be taken to its specific page. From there you could install the workflow to your graph. If the workflow is free, it will be installed immediately. If it's a paid workflow, you will need to enter your card information first before the workflow is installed into your graph. Once successfully installed, you will be taken straight to page in your graph where your SmartBlock was installed, which should be under the `workflows` subtree in the `roam/js/smartblocks` page.

If you navigate to a SmartBlock page that you have already installed, there may be an update available. Clicking on the `Update` button will update your SmartBlock workflow, overwriting what exists. If you'd like to save the old version elsewhere, store it as a new name before updating. If you update a SmartBlock workflow and the author changed its name, it will download as a **second** copy on your graph. Be sure to delete the old version if you no longer want the old copy.

# Demo

[video](https://www.loom.com/share/40c1586aae754a91b764bb7848b1221c)
