const apiUrl = "https://www.archidekt.com/api/";

const formatKey = new Map([
    [1, 'Standard'],
    [2, 'Modern'],
    [3, 'Commander / EDH'],
    [4, 'Legacy'],
    [5, 'Vintage'],
    [6, 'Pauper'],
    [7, 'Custom'],
    [8, 'Frontier'],
    [9, 'Future Standard'],
    [10, 'Penny Dreadful'],
    [11, '1v1 Commander'],
    [12, 'Duel Commander'],
    [13, 'Brawl'],
    [14, 'Oathbreaker'],
    [15, 'Pioneer'],
    [16, 'Historic'],
    [17, 'Pauper EDH'],
]);

///////////////////////////////////////////////////////////

function getData(url)
{
    var options = {
        "muteHttpExceptions": true
    };
    var response = UrlFetchApp.fetch(url, options);
    return response.getContentText();
}

function getAllData(url)
{
    var outArray = [];

    do
    {
        var data = getData(url);
        data = JSON.parse(data);

        outArray = outArray.concat(data.results);
        url = data.next;

    } while (url != null);

    return outArray;
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

    // Retrieve deck metadata to include in file
    var header = new String();
    header += "# " + deck.name + "\n";
    header += "# " + formatKey.get(deck.deckFormat) + "\n";
    header += "\n";

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
    return header + decklist;
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

        // Strip second names from split/flip/etc. cards
        title = title.split(" // ")[0];

        // Piece together card fields
        var line = qty + " " + title;
        line += "\n";

        // If card's primary category is the special category of "Sideboard",
        // then it's in the sideboard.
        if (card.categories[0] == "Sideboard")
        {
            sideboard += line;
        }
        // If card's primary category is not an excluded category,
        // then it's in the mainboard.
        else if (!excludedCategories.includes(card.categories[0]))
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
    var userUrl = apiUrl + "decks/cards/?owner=" + config.username
        + "&ownerexact=true&pageSize=50";
    var allDeckData = getAllData(userUrl);

    // Setup map for folders to IDs, with root backup dir pre-set
    var folderMap = new Map([[0, config.backupDir]]);

    // Retrieve a list of decklists for file-management purposes
    var metaListFile = common.findOrCreateFile(config.backupDir, "meta.list.json", "{}");
    var killList = common.grabJson(metaListFile.getId());
    var metaList = {};

    // Iterate through the decks and retrieve each one
    for (const deck of allDeckData)
    {
        // Retrieve deck content
        var filename = deck.name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
        filename += "." + deck.id;
        var deckUrl = apiUrl + "decks/" + deck.id + "/small/?format=json";
        var deckContent = getData(deckUrl);
        // Convert deck to JSON
        var deckJson = JSON.parse(deckContent);

        // Create or retrieve folder from deck
        var folder = retrieveFolder(folderMap, deckJson.parentFolder);

        // Check that this decklist's name and folder haven't changed since
        // last time. If they have, they'll be on the kill list,
        // for us to remove later.
        if (killList[deck.id] &&
            killList[deck.id].filename == filename &&
            killList[deck.id].folderId == folder)
        {
            // metaList[deck.id] = killList[deck.id];
            delete killList[deck.id];
        }

        //  Parse JSON into Archidekt decklist, if requested
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

        // Add decklist to meta list for next time
        metaList[deck.id] = {
            "filename": filename,
            "folderId": folder
        };
    }

    // Delete decklists that no longer exist in the API, or have been moved
    if (config.removeMissingDecklists && Object.keys(killList).length > 0)
    {
        for (const [deckId, info] of Object.entries(killList))
        {
            common.deleteFile(info.folderId, info.filename + ".archidekt.txt");
            common.deleteFile(info.folderId, info.filename + ".basic.txt");
            common.deleteFile(info.folderId, info.filename + ".json");
        }
    }

    // Write the meta list for next time
    metaListFile.setContent(JSON.stringify(metaList));
}

function backupProfile(config)
{
    // Retrieve profile data
    var userUrl = apiUrl + "users/" + config.userId + "/";
    var profileData = getData(userUrl);
    var profile = JSON.parse(profileData);

    // Remove decklist (it's probably incomplete anyway)
    delete profile.decks;

    // Save profile as a json file in the indicated Google Drive folder
    common.updateOrCreateFile(config.backupDir, profile.username + ".json",
        JSON.stringify(profile, null, 4));
}

function main()
{
    backupProfile(config);
    backupDecks(config);
}