# Table of Contents

1. [Trigger Your Workflow](010-trigger-your-workflow.md)
2. [Understanding Commands](020-understanding-commands.md)
3. [Using Pre-Defined Workflows](030-using-pre-defined-workflows.md)
4. [Make Your Own Workflows](040-make-your-own-workflows.md)
5. [Command Reference](050-command-reference.md)
6. [Alternative Methods](060-alternative-methods.md)
7. [Developer Docs](070-developer-docs.md)

# SmartBlocks Command Reference

This is a directory of all of the supported commands in the SmartBlocks extension.

- [Date/Time](#datetime-commands)
- [Serendipity](#serendipity-commands)
- [TODO](#todo-commands)
- [Block Related](#block-related-commands)
- [User Related](#user-related-commands)
- [Logic Control](#logic-control-commands)
- [Cursor](#cursor-commands)
- [Commands With Effects](#commands-with-effects)
- [Workflow Modifiers](#workflow-modifiers)
- [Common Ideas](#common-ideas)

# **Date/Time Commands**

Date/Time commands use relative timing to resolve to Roam dates and times

## DATE

**Purpose**: Use a date natural language processor to return a properly formatted Roam date. An optional second parameter allows you to control the format of the returned date.

**Parameters**:

1. An expression that will resolve to a date
2. Optional parameter that tells SmartBlocks to not return a Roam formatted date, but a date formatted in the format you specify. Supported date formats defined here: https://date-fns.org/v2.22.1/docs/format. Examples:

`yyyy-MM-dd`: 2020-10-12

`MMM dd`: Oct 12

`ww`: 42

**Examples**:

- `<%DATE:Today%>`
- `<%DATE:Friday%>`
- `<%DATE:Friday%>`
- `<%DATE:5 days from now%>`
- `<%DATE:In two weeks%>`
- `<%DATE:In two weeks,yyyy-MM-dd%>`

**Special notes:**

DATE also supports special abbreviations:

- DBOM or DEOM = Beginning/End of month
- DBONM or DEONM = Beginning/End of next month
- DBOY or DEOY = Beginning/End of year
- DBONY or DEONY = Beginning/End of next year

## TIME

**Purpose**: Inserts the time in 24 hour format

**Parameters**:

1. An optional expression that can resolve to a time

**Example**:

- `<%TIME%>`

## TIMEAMPM

**Purpose**: Inserts the time in AM/PM format

**Parameters**:

1. An optional expression that can resolve to a time

**Example**:

- `<%TIMEAMPM%>`

## DATEBASIS

**Purpose**: Changes the date basis used by SmartBlocks in determining the context in which dates are calculated. By default, TODAY's date is the basis for all commands.

Video explanation of DATEBASIS: [video](https://youtu.be/czgw0YVH410)

This command sets the mode for the workflow. You can change between modes in one workflow.

**Parameters**:

1. Date basis to be used in the workflow
   - If DNP - will use the date of the Daily Notes Page if the workflow is run on a DNP, otherwise will still use today.
   - Otherwise provide a natural language date command to determine the date basis

**Examples**:

- `<%DATEBASIS:DNP%>`
  - Uses the Daily Note Page date that the workflow is run on, if it's not a DNP it will use Today's date
- `<%DATEBASIS:today%>`
  - Use today's date as the basis
- `<%DATEBASIS:in 3 days%>`
  - Use the date 3 days from now as the date basis
- `<%DATEBASIS:in two weeks%>`

# **Serendipity Commands**

Serendipity commands are commands that help resolve to a random block from your page.

## RANDOMBLOCK

**Purpose**: Grabs a random block from your graph and inserts it as a block reference.

**Parameters**: no parameters

**Example**:

- `<%RANDOMBLOCK%>`

## RANDOMBLOCKFROM

**Purpose**: Returns a random block from a page or a child block from a parent block provided in the parameter

**Parameters**:

1. Page to pull a child from. Could be either:
   - Option 1: **Page name** or **tag name** (brackets `[[]]` or hashtag `#` are optional)
   - Option 2: Parent block UID
2. Levels within the page to include. Specifying 0 includes all blocks
3. Format to output the block in. See our [Formatting](050-command-reference.md#formatting) section for more info.

**Example**:

- `<%RANDOMBLOCKFROM:Evergreen Notes%>`
- `<%RANDOMBLOCKFROM:935dpJL8X%>`

## RANDOMBLOCKMENTION

**Purpose**: Returns a random block from places where the page is referenced.

**Parameters**: One or more parameters as a Page name or tag name (brackets `[[]]` or hashtag `#` are optional)

**Example**:

- `<%RANDOMBLOCKMENTION:Evergreen Notes%>`

## RANDOMCHILDOFMENTION

_Previously called `RANDOMCHILDOF`_

**Purpose**: Returns a random child block of a block that's referencing the input page

**Parameters**:

1. One parameter that could be either:
   - Option 1: **Page name** or **tag name** (brackets `[[]]` or hashtag `#` are optional)
   - Option 2: Parent block UID
2. Levels within the page to include. Specifying 0 includes all blocks
3. Format to output the block in. See our [Formatting](050-command-reference.md#formatting) section for more info.
4. Optional filter parameter. See our [Filtering](050-command-reference.md#filtering) section for more info.

**Examples**:

- `<%RANDOMCHILDOFMENTION:Evergreen Notes%>`
- `<%RANDOMCHILDOFMENTION:[[ONE BLOG POST A DAY/Candidates]],1,{{embed-path:(({uid}))}},-[[DONE]]%>`

## FIRSTCHILDOFMENTION

**Purpose**: Returns the first child block of a block that's referencing the input page

**Parameters**:

1. One parameter that could be either:
   - Option 1: **Page name** or **tag name** (brackets `[[]]` or hashtag `#` are optional)
   - Option 2: Parent block UID
2. Format to output the block in. See our [Formatting](050-command-reference.md#formatting) section for more info.
3. Optional filter parameter. See our [Filtering](050-command-reference.md#filtering) section for more info.

**Examples**:

- `<%FIRSTCHILDOFMENTION:Evergreen Notes%>`
- `<%FIRSTCHILDOFMENTION:[[ONE BLOG POST A DAY/Candidates]],{{embed-path:(({uid}))}},-[[DONE]]%>`

## RANDOMNUMBER

**Purpose**: Returns a random number

**Parameters**:

- A Minimum value
- A Maximum value

**Example**:

- `<%RANDOMNUMBER:1,10%>`

## RANDOMPAGE

**Purpose**: Grabs a random page from your graph and inserts it.

**Parameters**: no parameters

**Example**:

- `<%RANDOMPAGE%>`

# **TODO Commands**

TODO commands are multi-block commands that query multiple TODOs from your graph based on a set of conditions.

## TODOTODAY

**Purpose**: Returns a list of block references of TODOs for today

**Parameters:**

1. Maximum amount of block references to return. Default value is `20`
2. Format to output the block in. See our [Formatting](050-command-reference.md#formatting) section for more info.
3. Optional filter parameter. See our [Filtering](050-command-reference.md#filtering) section for more info.

**Example**: `<%TODOTODAY:20,(({uid}))%>`

## TODOOVERDUE

**Purpose**: Returns a list of block references of TODOs for overdue TODOs. That is TODOs that have a dated page reference in them.

**Parameters:**

1. Maximum amount of block references to return. Default value is `20`
2. Format to output the block in. See our [Formatting](050-command-reference.md#formatting) section for more info.
3. Optional filter parameter. See our [Filtering](050-command-reference.md#filtering) section for more info.

**Examples**: `<%TODOOVERDUE:20,(({uid}))%>`

## TODOOVERDUEDNP

**Purpose**: Returns a list of block references of TODOs for overdue TODOs. That is TODOs that have a dated page reference in them. Additionally TODOs that are on a Daily Notes Page (DNP) without a date from the past.

**Parameters:**

1. Maximum amount of block references to return. Default value is `20`
2. Format to output the block in. See our [Formatting](050-command-reference.md#formatting) section for more info.
3. Optional filter parameter. See our [Filtering](050-command-reference.md#filtering) section for more info.

**Examples**: `<%TODOOVERDUEDNP:20,(({uid}))%>`

## TODOFUTURE

**Purpose**: Returns a list of block references of TODOs for future TODOs. That is TODOs that have a dated page reference in them.

**Parameters:**

1. Maximum amount of block references to return. Default value is `20`
2. Format to output the block in. See our [Formatting](050-command-reference.md#formatting) section for more info.
3. Optional filter parameter. See our [Filtering](050-command-reference.md#filtering) section for more info.

**Examples**:`<%TODOFUTURE:20,(({uid}))%>`

## TODOFUTUREDNP

**Purpose**: Returns a list of block references of TODOs for future TODOs. That is TODOs that have a dated page reference in them. Additionally TODOs that are on a Daily Notes Page (DNP) without a date on a future date.

**Parameters:**

1. Maximum amount of block references to return. Default value is `20`
2. Format to output the block in. See our [Formatting](050-command-reference.md#formatting) section for more info.
3. Optional filter parameter. See our [Filtering](050-command-reference.md#filtering) section for more info.

**Examples**: `<%TODOFUTUREDNP:20,(({uid}))%>`

## TODOUNDATED

**Purpose**: Returns a list of block references of TODOs with no date tag nor on DNPs

**Parameters:**

1. Maximum amount of block references to return. Default value is `20`
2. Format to output the block in. See our [Formatting](050-command-reference.md#formatting) section for more info.
3. Optional filter parameter. See our [Filtering](050-command-reference.md#filtering) section for more info.

**Examples**: `<%TODOUNDATED:20,(({uid}))%>`

# **Block Related Commands**

Block Related commands provide commands for grabbing values in blocks and other properties from your graph.

## ATTRIBUTE

**Purpose**: Returns the arguments as a Roam attribute, so that your workflow definition doesn't create a reference

**Parameters**:

1. Text to turn into attribute

**Example**:

- `<%ATTRIBUTE:Date%>`

## BLOCKMENTIONS

**Purpose**: returns a list of blocks that mention a page reference, with optional filtering. This is a multi-block command and has some limitations how it interacts with other commands.

[Video Demonstration](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FZeVVCoC39I.mp4?alt=media&token=2a6be385-b544-44ff-a281-711d41b62a4f)

**Parameters**: List of comma separated parameters

1. Maximum amount of block references to return.
   if set to -1, will return only count of matches

2. Page name or tag name (This parameter is case-sensitive and must match your page or tag name as used in your graph)
3. Format to output the block in. See our [Formatting](050-command-reference.md#formatting) section for more info.
4. Optional filtering parameters, with support for include and excluding blocks based on their text and the page their in with simple text comparison

**Example**:

- `<%BLOCKMENTIONS:15,toRead%>`
  - Returns up to 15 blocks that mention `#toRead` or `[[toRead]]`
- `<%BLOCKMENTIONS:15,toRead,{uid},book%>`
  - Returns up to 15 blocks that mention `#toRead` or `[[toRead]]` that also have the word "book" in the text of the block
- `<%BLOCKMENTIONS:15,toRead,{uid},book,pinnacle%>`
  - Returns up to 15 blocks that mention `#toRead` or `[[toRead]]` that also have the words "book" and "pinnacle" in the text of the block
- `<%BLOCKMENTIONS:15,toRead,{uid},book,-pinnacle%>`
  - Returns up to 15 blocks that mention `#toRead` or `[[toRead]]` that also have the word "book" but not "pinnacle" in the text of the block

## BLOCKMENTIONSDATED

**Purpose**: returns a list of blocks that mention a page reference, based on a specified date range, with optional filtering. This is a multi-block command and has some limitations how it interacts with other commands.

**Parameters**: List of comma separated parameters

1. Maximum amount of block references to return.
   - if set to -1, will return only count of matches
2. Page name or tag name (This parameter is case-sensitive and must match your page or tag name as used in your graph)
3. Start date - tasks with a date from start date and beyond until parameter 3 (End Date). Date NLP is supported, so you can do something like: Today, yesterday, 2020-12-31 and other formats.
   - Set to 0 for no start date
   - Set parameter 3 and 4 to -1 to have it return blocks that have no date in them
4. End Date - all tasks from the end date and before, until parameter 2 (start date). Date NLP is supported, so you can do something like: Today, yesterday, 2020-12-31 and other formats.
   - Set to 0 for no end date
5. Sort Order
   - ASC - oldest dated blocks to newest
   - DESC - newest dated blocks to oldest
   - NONE - no date sort defined, just return them alphabetically
6. Format to output the block in. See our [Formatting](050-command-reference.md#formatting) section for more info.
7. Optional filtering parameters, with support for include and excluding blocks based on their text with simple text comparison. Filters are processed before date processing. This means if filters are designed to include or exclude text, they will be processed before the dates are processed.

**Example**:

- `<%BLOCKMENTIONSDATED:10,TODO,2020-12-1,2020-12-30,ASC%>`
  - Returns all blocks with [[TODO]] with a date reference from date Dec 1 to Dec 30, 2020 and do so in ascending order
- `<%BLOCKMENTIONSDATED:10,toRead,0,yesterday,DESC,-book%>`
  - Returns all blocks with [[toRead]] with a date reference up to end of December but don't have book in the text and the list the blocks in date descending order

## BREADCRUMBS

**Purpose:** Returns the path of parents for a given block reference.

**Parameters:**

1. Block Reference UID
   - Add a + to front of UID to get back just the page title
   - Add a - to get back just the path, without the page title
2. Separator to be used to separate each parent

**Example:**

- `<%BREADCRUMBS:(( UID )),>%>`
  - Will use > as a separator between block refs
- `<%BREADCRUMBS:+(( UID )),>%>`
  - Returns just the page title
- `<%BREADCRUMBS:-(( UID )),>%>`
  - Returns just the path blocks, no page title

## BUTTON

**Purpose**: Returns the arguments as a Roam button, so that your workflow definition doesn't create a button

**Parameters**:

1. Text of the button

**Example**:

`<%BUTTON:kanban%>`

## CHILDREN

**Purpose:** Gets the block tree nested under the input block reference.

**Parameters:**

1. Variable name or a block reference.
2. Start index, inclusive, 1 is first
3. End index, inclusive. If 0, it will go to the last child
4. Format to output the block in. See our [Formatting](050-command-reference.md#formatting) section for more info.
5. Levels of children to include. 0 will include all levels (default)

**Examples:**

`<%CHILDREN:((abc123def))%>`

## CONCAT

**Purpose:** Combines a comma separated list of strings into one string.

**Parameters** Comma separated list

**Examples**:

- `<%CONCAT:[,[pageName],]%> `
  - outputs `[[pageName]]`
- `<%CONCAT:[,[pageName],]]\, followed by more text%>`
  - outputs `[[pageName]]], followed by more text `

Special note: if you want a comma to be a part of the output, put a \ in front of it as in this last example

## CURRENTPAGENAME

**Purpose:** Returns the name of the current page. Stores it in a variable if present.

**Parameters**:

1. Variable name. If parameter is equal to `base`, then will return the base page name of a namespaced title instead.

**Example**:

`<%CURRENTPAGENAME%>`

## CURRENTURL

**Purpose:** Return the current URL of the page

**Parameters:** None

**Example:**

`<%CURRENTURL%>`

## CURRENTBLOCKREF

**Purpose:** Gets the current block reference. Stores it in a variable if present.

**Parameters:**

1. Name of variable
2. Whether or not to add `(())` formatting, defaulted to true. Set to `false` for just the id.

**Example**

- `<%CURRENTBLOCKREF:varName%>`
  - Will store the current block reference into a variable named `varName`

## CURRENTBLOCKCONTENT

**Purpose:** Gets the current block content. Stores it in a variable if present.

**Parameters:**

1. Name of variable

**Example**

- `<%CURRENTBLOCKCONTENT:varName%>`
  - Will store the current block reference into a variable named `varName`

## GETATTRIBUTE

**Purpose**: Returns the attribute value nested under the input block with a given input name.

**Parameters**:

1. Page name or block ref
2. The name of the attribute.

**Example**:

- `<%GETATTRIBUTE:ref,Name%>`

## TRIGGERREF

**Purpose:** Gets the block reference where the Smartblock was triggered from. Stores it in a variable if present.

**Parameters:**

1. Name of variable

**Example**

- `<%TRIGGERREF:varName%>`
  - Will store the current block reference into a variable named `varName`

## RESOLVEBLOCKREF

**Purpose**: Converts a block reference `(())` into its text equivalent

**Parameters**: Block Reference

**Example**:

- `<%RESOLVEBLOCKREF:abcdefghi%>`
- `<%RESOLVEBLOCKREF:((abcdefghi))%>`

## SEARCH

**Purpose**: searches all blocks for a specific string of case-sensitive text and returns a list of matching block references, with optional filtering

**Parameters**:

1. Maximum amount of block references to return.
2. Format to output the block in. See our [Formatting](050-command-reference.md#formatting) section for more info.
3. string of text to find (CASE-SENSITIVE)
4. Parameter 3 to X: Optional filtering parameters, with support for include and excluding blocks based on their text with simple text comparison. Prefix with `-` to say that the text shouldn't include a term

**Example**:

- `<%SEARCH:15,(({uid})),apple pie%>`
  - Returns up to 15 blocks that contain "apple pie"
- `<%SEARCH:15,(({uid})),apple pie,ice cream%>`
  - Returns up to 15 blocks that contain "apple pie" and "ice cream"
- `<%SEARCH:15,(({uid})),apple pie,ice cream. chocolate%>`
  - Returns up to 15 blocks that contain "apple pie" and "ice cream" and "chocolate"
- `<%SEARCH:15,(({uid})),apple pie,ice cream. chocolate,-vanilla%>`
  - Returns up to 15 blocks that contain "apple pie" and "ice cream" and "chocolate", but not including "vanilla"

## HASHTAG

**Purpose**: Returns the arguments as a Roam hashtag, so that your workflow definition doesn't create a reference

**Parameters**:

1. Text to tag

**Example**:

- `<%HASHTAG:Projects%>`

## TAG

**Purpose**: Returns the arguments as a Roam tag, so that your workflow definition doesn't create a reference

**Parameters**:

1. Text to tag

**Example**:

- `<%TAG:<%DATE:today%>%>`

## REPLACE

**Purpose**: Replaces the contents of the first argument by searching for the expression of the second argument with the result of the third argument.

**Parameters**:

1. Content to replace. Can be raw text, a SmartBlock Variable, or a block reference.
2. Expression to search for. Supports wrap in inline `code` styling.
3. Content to replace with. Can be raw text or a SmartBlock Variable
4. (Optional) regular expression flag. For instance, you could add a `g` here to replace all instances where the second argument appears.

**Example**:

- `<%REPLACE:This is a sentence,sentence,block%>`
- Regex examples
  - `<%REPLACE:b1ng is a search engine - bing.com,b.ng,google,g%>`
  - `<%REPLACE:The cat in the hat sat on the mat,[b-chm]at,((PtEIfqniW)),g%>`

## UPDATEBLOCK

**Purpose**: Updates the block in the first argument with the contents of the second

**Parameters**:

1. Reference of block to replace. Can be a SmartBlock variable
2. Content to replace with. Can be a SmartBlock variable

**Example**:

- `<%UPDATEBLOCK:ref,hello world!%>`

## DELETEBLOCK

**Purpose**: Deletes the block or page with the referenced UID.

**Parameters**:

1. Reference of block or page to delete. Can be a SmartBlock variable.

**Example**:

- `<%DELETEBLOCK:ref%>`
- `<%DELETEBLOCK:((BVJoEW-aq))%>`
- `<%DELETEBLOCK:Some Page Name%>`

## PARENT

**Purpose:** Returns the block ref that is the parent of the input block. Stores it in a variable if present.

**Parameters:**

1. Reference to grab the parent from
2. Name of variable
3. Whether or not to add `(())` formatting, defaulted to true. Set to `false` for just the id.

**Example**

- `<%PARENT:ref,varName%>`

# **User Related Commands**

## CURRENTUSER

**Purpose:** Return the display name of the user.

**Parameters:** None

**Example:**

`<%CURRENTUSER%>`

## AUTHOR

**Purpose:** Returns the username of the user who created the block or page.

**Parameters:**

1. Page name or block ref

**Example:**

`<%AUTHOR:((BVJoEW-aq))%>`

## ALLUSERS

**Purpose:** Returns all users in the graph.

**Parameters:** None

**Example:**

`<%ALLUSERS%>`

## ACTIVEUSERS

**Purpose:** Returns all users who created/edited a block.

Default is set to the last three month.

**Parameters:**

1. (Optional) NLP expression for date basis
2. (Optional) Format of Output

**Example:**

- `<%ACTIVEUSERS%>`
- `<%ACTIVEUSERS:this year,{text}%>`

# **Logic Control Commands**

Logic Control Commands are commands that facilitate control flow and decision points in the workflow.

## IFVAR

**Purpose**: Compares a variable with a given value. If the test fails, the block is skipped

**Parameters**:

1. Variable to compare
2. Value to compare the variable to

If the value starts and ends with `/`, it will be treated as a Regular Expression

If no value is specified, it's the same as checking if the block is empty

**Example**:

- `<%IFVAR:foo,true%>` - checks if variable `foo` has value `true`
- `<%IFVAR:foo,/.+/%>` - checks if variable `foo` is not empty
- `<%IFVAR:foo,/^$/%>` - checks if variable `foo` is empty

## IFNOTVAR

**Purpose**: Compares a variable with a given value. If the test succeeds, the block is skipped

**Parameters**:

1. Variable to compare
2. Value to compare the variable to

If the value starts and ends with `/`, it will be treated as a Regular Expression

If no value is specified, it's the same as checking if the block is empty

**Example**:

- `<%IFNOTVAR:foo,true%>` - checks if variable `foo` does not have value `true`
- `<%IFNOTVAR:foo,/.+/%>` - checks if variable `foo` is empty
- `<%IFNOTVAR:foo,/^$/%>` - checks if variable `foo` is not empty

## IFMATCH

**Purpose**: Compares the first argument with the second. If the test fails, the block is skipped.

**Parameters**:

1. Variable name or value to compare
2. Variable name or value to compare
   - If the value starts and ends with `/`, it will be treated as a Regular Expression

**Example**:

- `<%IFMATCH:foo,true%>`
  - checks if variable `foo` has value `true`. If no variable `foo` exists, it then checks to see if `foo` is equal in value to `true`, which would skip the block

## IFNOTMATCH

**Purpose**: Compares a variable with a given value. If the test succeeds, the block is skipped

**Parameters**:

1. Variable name or value to compare
2. Variable name or value to compare
   - If the value starts and ends with `/`, it will be treated as a Regular Expression

**Example**:

- `<%IFMATCH:foo,true%>`
  - - checks if variable `foo` has value `true`. If no variable `foo` exists, it then checks to see if `foo` is equal in value to `true`, which would keep the block

## IFDATEOFYEAR

**Purpose**: Using today's date, compares to the date of the year to see if there is a match.

If they match, the block is inserted

If there is no match, the block is not inserted

**Parameters**:

1. A number from 1 to 31 corresponding to the day in the month. Optionally, a comma separated list of numbers to test for multiple days

**Example**:

- `<%IFDATEOFYEAR:07/27%>`
  - Inserts this block if it is July 27th
- `<%IFDATEOFYEAR:01/01,04/01,09/01,12/01%>`
  - Inserts this block if it is the first day of the quarter

## IFDAYOFMONTH

**Purpose**: Using today's date, compares to the day in the month to see if there is a match.

If they match, the block is inserted

If there is no match, the block is not inserted

**Parameters**:

1. A number from 1 to 31 corresponding to the day in the month. Optionally, a comma separated list of numbers to test for multiple days

**Example**:

- `<%IFDAYOFMONTH:1%>`
  - Inserts this block if it is the first day of the month
- `<%IFDAYOFMONTH:15,30%>`
  - Inserts this block if it is the it is the 15th or 30th of the month

## IFDAYOFWEEK

**Purpose**: Using today's date, compares to the day of the week to see if there is a match.

If they match, the block is inserted.

If there is no match, the block is not inserted

**Parameters**:

1. A number from 1 to 7, 1 is Monday, 2 is Tuesday and so on. Optionally, a comma separated list of numbers to test for multiple days

**Example**:

- `<%IFDAYOFWEEK:7%>`
  - This block will be inserted if today is Sunday
- `<%IFDAYOFWEEK:1,3,5%>`
  - This block will be inserted if today is Monday, Wednesday or Friday

## IFTAGINBLOCK

**Purpose**: Using the block reference, compares to see if the tag is in the block.

If it is, the block is inserted.

If it isn't, the block is not inserted

**Parameters**:

1. Page or uid to check
2. A block reference to check

**Example**:

- `<%IFTAGINBLOCK:TODO,((block-ref))%>`

## IFCHILDREN

**Purpose**: Compares whether the current block produced children, and if not, skips.

**Parameters**: No Parameters

**Example**:

- `<%IFCHILDREN:TODO,((block-ref))%>`

## INPUT

**Purpose**: prompts user for input which will then be inserted into the block

**Parameters**: Parameters in this command are delimited by `%%`

1. Text that will be displayed to the user.

   - Could add a `{page}` placeholder to turn the input into a Page Input that accepts page values.
   - Could add a `{block}` placeholder to turn the input into a Block Input that accepts block values and returns the text.
   - Could add a `{ref}` placeholder to turn the input into a Block Input that accepts block values and returns the reference.

2. Default value for the input
3. Any number of other options. Specifying 3 or more parameters turn the input from a text input to a dropdown.

- **Example 1**: (No default value for input)
  - `<%INPUT:Attendees for this meeting?%>`
- **Example 2**: (Default value for input)
  - `<%INPUT:Attendees for this meeting?%%Jim, Sally, Bob%>`
- **Example 3**: (Dropdown for input)
  - `<%INPUT:Guest for this meeting?%%Jim%%Sally%%Bob%>`
- **Example 4**: (Page Input)
  - `<%INPUT:Guest for this meeting?{page}%>`

## FORM

**Purpose**: prompts user for a series of inputs which will then be inserted into the block

**Parameters**:

- Block reference pointing to the Form Configuration. The Form Configuration should be a tree
  - fields - a tree of fields to include in the form
    - name - the name of each field. When the form is submitted, this name is used for the output variable
      - type - The type of field. The following values are supported
        - text
        - number
        - select
        - page
        - block
        - flag
        - embed
        - autocomplete
      - label - The label describing the field to the user
      - default - The default value the field should have
      - options - For `select` and `autocomplete` types, specifies the options available for selection.
      - conditional - Specifies a field `name` that this field depends on to be displayed.
      - conditionalValues - Specifies the values of the conditional field for which this field will be displayed.
    - output - what to do once the form is submitted. The supported values are:
      - block
      - variables
    - submit - the text assigned to the submit button
    - cancel - the text assigned to the cancel button

\*The form config supports nested SmartBlock commands.

**Example Form**

```
- Example Form
    - fields
        - This is Some Text
            - type
                - text
            - label
                - Text Field
        - This is a Number
            - type
                - number
            - label
                - Number Field
        - Just a Label
            - type
                - label
            - label
                - Text Field
        - Like a checkbox
            - type
                - flag
            - label
                - Flag Field
        - This is text that is conditional on the checkbox
            - type
                - text
            - label
                - Conditional Text Field
            - conditional
                - Like a checkbox
        - This searches all pages
            - type
                - page
            - label
                - Page Field
        - This searches all blocks
            - type
                - block
            - label
                - Block Field
        - Choose from multiple options
            - type
                - select
            - label
                - Select Field
            - options
                - apple
                - banana
                - orange
                - conditional select 1
        - This is a conditional text field based on the select field above
            - type
                - text
            - label
                - Conditional Text Field
            - conditional
                - Choose from multiple options
            - conditionalValues
                - conditional select 1
                - orange
        - This is an autocomplete field
            - type
                - autocomplete
            - label
                - Autocomplete Field
            - options:
                - apple
                - banana
                - orange
        - This is like a roam block
            - type
                - embed
            - label
                - Embed Field
```

```
- Form #SmartBlock
  - <%FORM:((S2MbRYozb))%>
```

**Embed Default**

To set the default text of `embed`, set a variable named the same as the name of the field and do not include a default.

```
- myForm
    - fields
        - myEmbed
            - type
                - embed
            - label
                - Some Label
- #SmartBlock embed
  - <%SET:myEmbed:123%><%FORM:((S2MbRYozb))>
```

## SET

**Purpose**: Sets the value of a variable in memory. Variables are case-sensitive.

**Parameters**:

1. Variable name
2. Value of Variable

**Example**:

- `<%SET:MyVariableName,my value%>`

## GET

**Purpose**: retrieves a variable from memory

**Parameters**:

1. Variable name. Should contain only letters and number, no special symbols. Variables are case-sensitive.

**Example**:

- `<%GET:MyVariableName%>`

## HAS

**Purpose**: checks if a variable is defined within the SmartBlock workflow, returns "true" or "false"

**Parameters**:

1. Variable name. Should contain only letters and number, no special symbols. Variables are case-sensitive.

**Example**:

- `<%HAS:MyVariableName%>`

## CLEARVARS

**Purpose**: Removes all variables from memory

**Parameters**: none

**Example**:

- `<%CLEARVARS%>`

## SUM

**Purpose:** Sum any number of parameters together and output the value. If one of them is a Daily Note Page, the result will be a Daily Note Page summing by the number of days.

**Parameters:**

1. Addend to sum

**Example:**

- `<%SUM:2,3,4%>`

## DIFFERENCE

**Purpose:** Finds the difference between two values. If the two values are daily note pages, returns the difference in number of days. If only one of the two values is a daily note page, the result with return a new daily note page based on the number of days before.

**Parameters:**

1. The minuend
2. The subtrahend

**Example:**

- `<%DIFFERENCE:2,1%>`

## PRODUCT

**Purpose:** Multiplies all of the parameters together and output the value.

**Parameters:**

1. Factor to multiply

**Example:**

- `<%PRODUCT:2,3,4%>`

## DIVISION

**Purpose:** Find the quotient between two parameters and output the value.

**Parameters:**

1. The dividend
2. The divisor

**Example:**

- `<%DIVISION:6,3%>`

## FLOOR

**Purpose:** Round down the input to the nearest whole numner.

**Parameters:**

1. The number to floor

**Example:**

- `<%FLOOR:3.14%>`

## ROUND

**Purpose:** Round the input to the nearest whole numner.

**Parameters:**

1. The number to round

**Example:**

- `<%ROUND:3.14%>`

## SMARTBLOCK

**Purpose:** Calls another smartblock workflow, outputting the result in place. The SmartBlock workflow will inherit variables defined in the parent smart block.

**Parameters:**

1. The workflow name
2. An optional page name to execute the workflow on another page. The command will return a block reference to the other page if this parameter is set.
3. When the second parameter is set, you may optionally pass an additional parameter in the format `order=value` to specify the order of the new block on that page. The value can be a number (0 to insert at the first position) or `last` to append to the end of the page.

**Example:**

- `<%SMARTBLOCK:MyWorkflow%>`
- `<%SMARTBLOCK:MyWorkflow,<%DATE:Tomorrow%>%>`
- `<%SMARTBLOCK:MyWorkflow,V_MTxadSW%>`
- `<%SMARTBLOCK:MyWorkflow,((V_MTxadSW)),order=0%>`
- `<%SMARTBLOCK:MyWorkflow,Some Page,order=last%>`
- `<%SMARTBLOCK:MyWorkflow,,order=3%>`

## REPEAT

**Purpose**: Repeats the second argument a specified amount of times.

If the first argument is another command (eg `<%CHILDREN%>`), then `Count of repeats` will be set to the number of results from that command.

This also passes SmartBlock variables:

- `ITERATION`: returns the current loop (eg: `1`, `2`, etc).
- `ITERATIONVALUE`: returns the item being iterated over from the first argument.

**Parameters**:

1. Count of repeats (or a SmartBlock command that returns items to iterate over)
2. Content to repeat

**Example**:

- `<%REPEAT:5,hello%>`
- `<%REPEAT:<%CHILDREN:((someUid))%>,<%SMARTBLOCK:runMe%>%>`
- runMe #SmartBlock
  - `<%GET:ITERATION%>`
  - `<%GET:ITERATIONVALUE%>`

# **Cursor Commands**

These commands affect focus and other DOM-related properties.

## CLIPBOARDCOPY

**Purpose**: Writes text content to the clipboard.

May not work in all browsers, please test in your environment

**Parameters**: text to be written to the clipboard.

**Example**:

- `<%CLIPBOARDCOPY:This text is written to clipboard%>`

## CLIPBOARDPASTETEXT

**Purpose**: Reads the text of the clipboard as text. May not work in all browsers, please test in your environment.

**Parameters**: Could add various settings, in any order, to manipulate the contents of the text

- `trim` - removes white space in the beginning and end of the pasted text.
- `split` - splits the pasted text into separate blocks
- `nohyphens` - removes leading hyphens
- `noextraspaces` - reduces extra spaces down to one space
- `nocarriagereturn` - removes the carriage return often found in copies on windows
- `returnasspace` - replaces returns with a space character instead

**Example**:

- `<%CLIPBOARDPASTETEXT%>`
- `<%CLIPBOARDPASTETEXT:trim,split%>`

## CURSOR

**Purpose**: define where cursor should be located after the workflow completes.

If a workflow contains multiple <%CURSOR%> commands, the last instance of it will be used. If there were multiple <%CURSOR%> commands left over after workflow is run, only the last instance is replaced.

**Parameters**: no parameters

**Example**:

- `<%CURSOR%>`

## INDENT

**Purpose:** Indent the current block if possible. Only works if preceded by a block in the same level.

**Parameters:** None

## UNINDENT

**Purpose:** Un-indent the current block if possible. Only works if the block lives in a nested level

**Parameters:** None

## FOCUSONBLOCK

**Purpose**: Focus on this block after the workflow finishes running by navigating to its page. If a workflow contains multiple <%FOCUSONBLOCK%> commands, the last instance of it will be used.

**Parameters**: no parameters

**Example**:

- `<%FOCUSONBLOCK%>`

# **Commands With Effects**

These are special commands that have side effects that affect your graph and the running workflow in different ways.

## EXIT

**Purpose**: Stops the workflow from going further after completing the current block.

**Parameters**: no parameters

**Example**:

- `<%EXIT%>`

## NOTIFICATION

**Purpose**: Displays a small pop-up notification message in the top of Roam.

[Video Demonstration of Notification](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FKWHurVktZW.mp4?alt=media&token=b9ffdb74-3c98-473b-a6d8-4fbe7024ce63)

**Parameters**:

1. Number of seconds the notification is visible
2. Message to be displayed. Supports Markdown rendering
3. Position of the notification. By default it shows on top. Valid values are

   - top
   - bottom
   - top left
   - top right
   - bottom left
   - bottom right

**Example**:

- `<%NOTIFICATION:10,Welcome to my SmartBlocks%>`
  - Displays the notification for 10 seconds with the text "Welcome to my SmartBlocks"
- `<%NOTIFICATION:120,Welcome to my **SmartBlocks**%>`
  - Displays the notification for 2 minutes (120 seconds) with the text "Welcome to my **SmartBlocks**"

## NOBLOCKOUTPUT

**Purpose**: Will prevent the block from being output from the workflow, no matter what other commands come after it. This is useful to do operations in the workflow that have no visual rendering (reading clipboard, setting variables)

**Parameters**: no parameters

**Example**:

- ` <%NOTIFICATION:5,This block will have no output%>``<%NOBLOCKOUTPUT%> `

## SKIPIFEMPTY

**Purpose**: Will prevent the block from being output from the workflow, if there is no content outputted from the block itself.

**Parameters**: no parameters

**Example**:

- ` <%NOTIFICATION:5,This block will have no output%>``<%SKIPIFEMPTY%> `

## OPENPAGE

**Purpose**: Opens a page or block. Creates a page if the reference doesn't exist.

**Parameters**:

1. Page name or block UID
2. Optional effect after navigating.

**Example**:

- `<%OPENPAGE:My Page%>`
- `<%OPENPAGE:gk78VGCKW,GOTOBLOCK 1%>`

## SIDEBARWINDOWOPEN

**Purpose**: Opens a page or block into the sidebar. Creates a page if the reference doesn't exist.

**Parameters**:

1. Accepts a page name or block reference
2. Optional effect after navigating.

**Example**:

- `<%SIDEBARWINDOWOPEN:My Page%>`
- `<%SIDEBARWINDOWOPEN:gk78VGCKW%>`
- `<%SIDEBARWINDOWOPEN:gk78VGCKW,GRAPH%>`

## OPENREFERENCESINSIDEBAR

**Purpose**: Opens all blocks referencing a page or block into the sidebar. Creates a page if the reference doesn't exist.

**Parameters**:

1. Accepts a page name or block reference

**Example**:

- `<%OPENREFERENCESINSIDEBAR:My Page%>`

## SIDEBARWINDOWCLOSE

**Purpose**: Closes a window in the right sidebar or all windows

**Parameters**:

1. A number. 0 will close all windows in the right sidebar. Greater than or equal to 1 will close the corresponding sidebar based on its position. Window 1 is at the top and numbers down

**Example**:

- `<%SIDEBARWINDOWCLOSE:0%>`
- `<%SIDEBARWINDOWCLOSE:1%>`

## SIDEBARSTATE

**Purpose**: changes the state of either the left or right sidebar

**Parameters**:

1. Accepts one parameter, a value of 1 to 4
   - `1` opens the left sidebar
   - `2` closes the left sidebar
   - `3` opens the right sidebar
   - `4` closes the right sidebar

**Example**:

- `<%SIDEBARSTATE:2%>`
- `<%SIDEBARSTATE:3%>`

## APIGET

**Purpose**: Fires an API request to the input url and returns the data to the block. If the return is a JSON object, it will be stringified.

**Parameters**:

1. URL
2. Optional Field to return a specific field in the response data. Uses the [lodash](https://lodash.com/docs/4.17.15#get) syntax for nested field values.

**Example**:

- `<%APIGET:https://deckofcardsapi.com/api/deck/new/shuffle/?deck_count=1%>`

# **Workflow Modifiers**

Add any of these commands to the workflow name to modify the workflow's entire behavior.

## HIDE

**Purpose:** Excludes this workflow from the SmartBlock Menu

**Usage**

- `#SmartBlock NameOfSmartBlock <%HIDE%>`

## CMD

**Purpose:** Opt the workflow into appearing in Roam's command palette when the Command Palette setting requires it

**Usage**

- `#SmartBlock NameOfSmartBlock <%CMD%>`

## NOCURSOR

**Purpose:** After a SmartBlock has finished running, Roam should be left in a non-edit state, meaning no block currently has editing focus

**Usage**

- `#SmartBlock NameOfSmartBlock <%NOCURSOR%>`

# **Common Ideas**

There are several ideas shared across multiple Smart Block commands to bring consistency in how they resolve. This section details each of those ideas.

## Formatting

Several commands support a "Format" argument that allow you to specify exactly how a returned block from a command should display. This format could be specified in plain text, but also supports the following placeholders:

- `{uid}` - resolves to the block reference
- `{page}` - resolves to the page the block originated from
- `{path}` - resolves to the uids of blocks that are parents of the current block, delimited by `>`
- `{attr:name:format}` - resolves the attribute value of the attribute found on the page with the block. Replace `name` with the name of the attribute. The `format` is optional and could be used to specify additional text that only appears if the attribute is on the page.
- `{text}` - resolves to the raw text of the block

## Filtering

Several commands support an optional filter parameter based on a comma separated list (case-sensitive). Can use `-` in front of a word to exclude it. Examples:

- toRead,Pinnacle
  - returns blocks with toRead AND Pinnacle in the text
- toRead|Pinaccle
  - returns blocks with toRead OR Pinnacle in the text
- toRead,-Pinnacle
  - returns blocks with toRead but not if they have pinnacle
