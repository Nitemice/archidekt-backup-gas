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
    var thisFolder = findOrCreateFolder(parentFolder, folder.name);
    folderMap.set(folderId, thisFolder.getId());
    return thisFolder.getId();
}

function parseDeck(deck)
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
        var foil = card.modifier == "Foil";
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

function backupDecks(config)
{
    // Retrieve a list of all the (public) decks
    var userUrl = apiUrl + "users/" + config.userId + "/";
    var allDeckData = getData(userUrl);
    var allDecks = JSON.parse(allDeckData);

    // Save the list of decks as a json file in the indicated Google Drive folder
    updateOrCreateFile(config.backupDir, allDecks.username + ".json", allDeckData);

    // If we don't need to save individual decks, bail out
    if (!config.saveAsJson && !config.saveAsTxt)
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

        // Save unmodified deck JSON, if requested
        if (config.saveAsJson)
        {
            // Exclude view count field
            // It increments no matter what, so it's not really meaningful
            delete deckJson.viewCount;

            updateOrCreateFile(folder, filename + ".json", JSON.stringify(deckJson, null, 4));
        }

        //  Parse JSON into decklist, if requested
        if (config.saveAsTxt)
        {
            var deckList = parseDeck(deckJson);
            updateOrCreateFile(folder, filename + ".txt", deckList);
        }
        // Logger.log("X");
    }
}

function main()
{
    // Retrieve config file
    var config = grabJson(configId);

    // Request all decks separately
    backupDecks(config);
}