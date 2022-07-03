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
    [18, 'Alchemy'],
    [19, 'Explorer'],
    [20, 'Historic Brawl'],
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

function getDecksFromFolders(folderId, parentDriveId)
{
    // Query the API for info on the folder
    var folderUrl = apiUrl + "decks/folders/" + folderId + "/?format=json";
    var folderData = getData(folderUrl);
    var folder = JSON.parse(folderData);

    // Create this folder, or get its Drive ID
    var thisFolder = common.findOrCreateFolder(parentDriveId, folder.name);
    var thisFolderId = thisFolder.getId();

    // Add folder Drive ID to deck info
    var decks = folder.decks;
    for (var deck of decks)
    {
        deck.parentFolder = thisFolderId;
    }

    // Retrieve all decks from any subfolders
    for (const subfolder of folder.subfolders)
    {
        var subfolderDecks = getDecksFromFolders(subfolder.id, thisFolderId);
        decks = decks.concat(subfolderDecks);
    }

    return decks;
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

function parseDeckJson(deckJson)
{
    // Remove stuff that we don't even want in the raw JSON
    var output = filterDeckJson(deckJson);

    // Remove fields that we don't really care about.
    // - Generic owner info
    // - Card oracle info
    // - Card flavor text

    // Also exclude fields that change too often.
    // - View count increments no matter what, so it's not really meaningful.
    // - Prices change all the time, and we don't really care.
    // - Online retail IDs: I don't know why, but seem to be constantly changing.

    delete output.owner.avatar;
    delete output.owner.frame;
    delete output.owner.ckAffiliate;
    delete output.owner.tcgAffiliate;

    for (const key in output.cards)
    {
        output.cards[key].card.name = output.cards[key].card.oracleCard.name;
        output.cards[key].card.salt = output.cards[key].card.oracleCard.salt;

        delete output.cards[key].card.artist;
        delete output.cards[key].card.flavor;
        delete output.cards[key].card.games;
        delete output.cards[key].card.options;
        delete output.cards[key].card.rarity;

        delete output.cards[key].card.oracleCard;
    }

    return JSON.stringify(output, null, 4);
}

function filterDeckJson(deckJson)
{
    var output = { ...deckJson };
    // Exclude fields that change too often.
    // - View count increments no matter what, so it's not really meaningful.
    // - Prices change all the time, and we don't really care.
    // - Online retail IDs: I don't know why, but seem to be constantly changing.

    delete output.viewCount;

    for (const key in output.cards)
    {
        delete output.cards[key].card.ckFoilId;
        delete output.cards[key].card.ckNormalId;
        delete output.cards[key].card.mtgoFoilId;
        delete output.cards[key].card.mtgoNormalId;
        delete output.cards[key].card.tcgProductId;
        delete output.cards[key].card.cmEd;
        delete output.cards[key].card.prices;
    }

    return output;
}

function backupDecks()
{
    // Retrieve a list of deck lists for file-management purposes
    var metaListFile = common.findOrCreateFile(config.backupDir,
        "meta.list.json", "{}");
    var killList = common.grabJson(metaListFile.getId());
    var metaList = {};

    // Retrieve a list of all the (public) deck lists in the specified folders
    var folderDecks = [];
    if (Object.keys(config).includes("deckFolders"))
    {
        for (const folderId of config.deckFolders)
        {
            var decksInFolder = getDecksFromFolders(folderId, config.backupDir);
            folderDecks = folderDecks.concat(decksInFolder);
        }
    }

    // Retrieve a list of all the (public) decks owned by the specified user
    var userDecks = [];
    if (!config.onlyBackupFolders)
    {
        var userUrl = apiUrl + "decks/cards/?userid=" + config.userId
            + "&pageSize=50";
        userDecks = getAllData(userUrl);
    }

    // Reconcile deck lists in folders with user's public deck lists
    var allDecks;
    {
        var folderDecksIds = folderDecks.flatMap(deckInfo => deckInfo.id);
        var minimumUserDecks = userDecks.filter(deckInfo =>
            !folderDecksIds.includes(deckInfo.id)
        );

        // Add root backup folder Drive ID to deck info
        for (var deck of minimumUserDecks)
        {
            deck.parentFolder = config.backupDir;
        }

        allDecks = folderDecks.concat(minimumUserDecks);
    }

    // Iterate through the decks and retrieve each one
    for (const deck of allDecks)
    {
        // Retrieve deck content
        var filename = deck.name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
        filename += "." + deck.id;
        var folder = deck.parentFolder;
        var deckUrl = apiUrl + "decks/" + deck.id + "/?format=json";
        var deckContent = getData(deckUrl);
        // Convert deck to JSON
        var deckJson = JSON.parse(deckContent);

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
            common.updateOrCreateFile(folder, filename + ".archidekt.txt",
                deckList);
        }

        //  Parse JSON into basic decklist, if requested
        if (config.outputFormat.includes("basic"))
        {
            var deckList = parseDeckToBasic(deckJson);
            common.updateOrCreateFile(folder, filename + ".basic.txt",
                deckList);
        }

        // Save deck as JSON, if requested
        if (config.outputFormat.includes("json"))
        {
            var jsonOutput = parseDeckJson(deckJson);
            common.updateOrCreateFile(folder, filename + ".json", jsonOutput);
        }

        // Save (mostly) unmodified deck JSON, if requested
        if (config.outputFormat.includes("rawJson"))
        {
            var jsonOutput = JSON.stringify(filterDeckJson(deckJson), null, 4);
            common.updateOrCreateFile(folder, filename + ".raw.json", jsonOutput);
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

function backupProfile()
{
    // Retrieve profile data
    var userUrl = apiUrl + "users/" + config.userId + "/";
    var profileData = getData(userUrl);
    var profile = JSON.parse(profileData);

    // Remove list of decks (it's only the first 50)
    delete profile.decks;

    // Save profile as a json file in the indicated Google Drive folder
    common.updateOrCreateFile(config.backupDir, profile.username + ".json",
        JSON.stringify(profile, null, 4));
}

function main()
{
    backupProfile();
    backupDecks();
}