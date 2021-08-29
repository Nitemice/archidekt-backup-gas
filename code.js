const apiUrl = "https://www.archidekt.com/api/";

///////////////////////////////////////////////////////////

function getData(url)
{
    var options = {
        "muteHttpExceptions": true
    };
    var response = UrlFetchApp.fetch(url, options);
    return response.getContentText();
}

function retrieveFolder(folderMap, folderId)
{
    if (folderMap.has(folderId))
    {
        return folderMap.get(folderId);
    }

    // Query the API for info on the folder
    var folderUrl = apiUrl + "decks/folders/" + folderId + "/?format=json";
    var folderData = getData(folderUrl);
    var folder = JSON.parse(folderData);

    // Retrieve the parent folder, to create this folder in
    // Check that this folder is accessible (public)
    if (folder.detail == "Authentication credentials were not provided.")
    {
        // Treat this folder as if it were the root backup folder
        return folderMap.get(0);
    }

    // Retrieve the root backup folder, if this doesn't have a parent folder
    var parentFolderId = (folder.parentFolder == null) ? 0 : folder.parentFolder.id;
    var parentFolder = retrieveFolder(folderMap, parentFolderId);

    // Create the folder, or get its Drive ID
    var thisFolder = common.findOrCreateFolder(parentFolder, folder.name);
    folderMap.set(folderId, thisFolder.getId());
    return thisFolder.getId();
}

function parseDeckToArchidekt(deck)
{
    // Parse categories, so we have the right category settings
    var categories = new Map();
    for (const category of deck.categories)
    {
        var fullCategory = category.name;
        if (!category.includedInDeck)
        {
            fullCategory += "{noDeck}"
        }
        if (!category.includedInPrice)
        {
            fullCategory += "{noPrice}"
        }
        if (category.isPremier)
        {
            fullCategory += "{top}"
        }
        categories.set(category.name, fullCategory);
    }

    // Iterate through each card, parse & append to the decklist
    var decklist = new String();
    for (const card of deck.cards)
    {
        // Retrieve card info
        var qty = card.quantity;
        var title = card.card.oracleCard.name;
        var set = card.card.edition.editioncode;
        var foil = (card.modifier == "Foil");
        var category = new String();
        card.categories.forEach(element =>
        {
            if (category.length)
            {
                category += ",";
            }
            category += categories.get(element);
        });

        // Piece together card fields
        var line = qty + "x " + title + " (" + set + ") ";
        if (foil)
        {
            line += "*F* ";
        }
        if (category.length)
        {

            line += "[" + category + "]";
        }
        line += "\n";

        decklist += line;
    }
    return decklist;
}

function parseDeckToBasic(deck)
{
    // Build a list of included/excluded categories
    var excludedCategories = new Array();
    for (const category of deck.categories)
    {
        if (!category.includedInDeck)
        {
            excludedCategories.push(category.name);
        }
    }

    // Iterate through each card, parse & append to the decklist
    var mainboard = new String();
    var sideboard = new String();
    for (const card of deck.cards)
    {
        // Retrieve card info
        var qty = card.quantity;
        var title = card.card.oracleCard.name;


        // Piece together card fields
        var line = qty + " " + title;
        line += "\n";

        // If card is in the special category of "Sideboard",
        // then it's in the sideboard
        if (card.categories.includes("Sideboard"))
        {
            sideboard += line;
        }
        else if (!card.categories.some(r => excludedCategories.includes(r)))
        {
            mainboard += line;
        }

    }
    return mainboard + "\n\n" + sideboard;
}

function filterDeckJson(deckJson)
{
    const output = { ...deckJson };
    // Exclude fields that change too often.
    // - view count increments no matter what, so it's not really meaningful
    // - prices change all the time, and we don't really care
    delete output.viewCount;
    for (const key in output.cards)
    {
        delete output.cards[key].card.prices;
    }

    return output;
}

function backupDecks(config)
{
    // Retrieve a list of all the (public) decks
    var userUrl = apiUrl + "users/" + config.userId + "/";
    var allDeckData = getData(userUrl);
    var allDecks = JSON.parse(allDeckData);

    // Save the list of decks as a json file in the indicated Google Drive folder
    common.updateOrCreateFile(config.backupDir, allDecks.username + ".json",
                              common.prettyPrintJsonStr(allDeckData));

    // If we don't need to save individual decks, bail out
    if (!config.hasOwnProperty("outputFormat") || !config.outputFormat.length)
    {
        return;
    }

    // Setup map for folders to IDs, with root backup dir pre-set
    var folderMap = new Map([[0, config.backupDir]]);

    // Iterate through the decks and retrieve each one
    for (const deck of allDecks.decks)
    {
        // Retrieve deck content
        var filename = deck.name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
        filename += "." + deck.id;
        var deckUrl = apiUrl + "decks/" + deck.id + "/small/?format=json";
        var deckContent = getData(deckUrl);
        // Convert deck to JSON
        var deckJson = JSON.parse(deckContent);

        // Retrieve folder from deck
        // Create or retrieve folder
        var folder = retrieveFolder(folderMap, deckJson.parentFolder);

        //  Parse JSON into Archidekt decklist, if requested
        // if (config.outputFormat.some((x) => x != "json"))
        if (config.outputFormat.includes("archidekt"))
        {
            var deckList = parseDeckToArchidekt(deckJson);
            common.updateOrCreateFile(folder, filename + ".archidekt.txt", deckList);
        }

        //  Parse JSON into basic decklist, if requested
        if (config.outputFormat.includes("basic"))
        {
            var deckList = parseDeckToBasic(deckJson);
            common.updateOrCreateFile(folder, filename + ".basic.txt", deckList);
        }

        // Save (mostly) unmodified deck JSON, if requested
        if (config.outputFormat.includes("json"))
        {
            var jsonOutput = JSON.stringify(filterDeckJson(deckJson), null, 4);
            common.updateOrCreateFile(folder, filename + ".json", jsonOutput);
        }
    }
}

function main()
{
    // Request all decks separately
    backupDecks(config);
}