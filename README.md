# Archidekt Backup Script

*Export deck lists from Archidekt, as text and/or JSON, using Google Apps Script.*

This script can be used to automatically bulk-export a user's collection of
public deck lists as both text and JSON. They are stored in a specified
Google Drive directory, where they can be easily downloaded or shared.

**NOTE**: All deck lists being exported (and the folders they are in, if you want to maintain the folder structure) must be set to public.
This option can be found under the "Settings" for each deck, or in the "⫶" menu in the folder view.

## Usage

This script is designed to be run on-demand via the GAS interface, or
periodically via GAS triggers. For more info on setting up GAS triggers, see
[this Google Apps Script guide](https://developers.google.com/apps-script/guides/triggers).

To execute the script, simply run the `main()` function.

## Setup

There are two basic steps necessary to run this script.

1. [Customize your config file](#1.-Customize-your-config-file)
2. [Load the script into a new Google Apps Script project](#2.-Load-the-script-into-a-new-Google-Apps-Script-project)

### 1. Customize your config file

`config.js` should contain a single JavaScript object, used to specify all
necessary configuration information. Here's where you specify the user, the
desired format(s), as well as the Google Drive directory to save exported
files to.

An example version is provided, named `example.config.js`, which can be
renamed or copied to `config.js` before loading into the GAS project.

The basic structure can be seen below.

```js
const config = {
    "userId": "<Archidekt user ID>",
    "saveAsJson": true/false,
    "saveAsTxt": true/false,
    "backupDir": "<Google Drive directory ID>"
};
```

- `userId`: User ID of the Archidekt user whose deck lists are being exported.
    This can be found by navigating to the user's profile page, and grabbing
    the ID from the tail of the URL.
- `saveAsJson`: This will export each deck as raw, (mostly) unedited JSON file,
    direct from the API. This is useful if you want to capture some details of
    the cards or deck that are not preserved by the text format.
- `saveAsTxt`: This will export each deck as a text file, in the format of
    Archidekt's edit view, preserving all categories & edition information.
- `backupDir`: The ID of the Google Drive directory, where exported maps
    should be stored. This can be found by navigating to the folder, and
    grabbing the ID from the tail of the URL.

### 2. Load the script into a new Google Apps Script project

You can manually load the script into a
[new GAS project](https://www.google.com/script/start/),
by simply copying and pasting it into the editor.

Or you can use a
[tool like clasp](https://developers.google.com/apps-script/guides/clasp)
to upload it directly. For more information on using clasp, here is a
[guide I found useful](https://github.com/gscharf94/Clasp-Basics-for-Reddit).
