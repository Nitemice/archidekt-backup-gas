const apiUrl = "https://www.archidekt.com/api/";


function grabJson(id)
{
    var file = DriveApp.getFileById(id).getAs("application/json");
    return JSON.parse(file.getDataAsString());
}

function saveJson(id, content)
{
    var file = DriveApp.getFileById(id);
    // Set the file contents
    file.setContent(JSON.stringify(content));
}

function findOrCreateFolder(parentDir, foldername)
{
    // See if there's already a folder in the indicated Google Drive folder
    var backupFolder = DriveApp.getFolderById(parentDir);
    var folders = backupFolder.getFoldersByName(foldername);

    if (folders.hasNext())
    {
        return folders.next();
    }
    else
    {
        // Create a new folder
        Logger.log("Created new folder: " + foldername);
        return backupFolder.createFolder(foldername);
    }
}

function findOrCreateFile(parentDir, filename, content)
{
    var file;

    // See if there's already a file in the indicated Google Drive folder
    var backupFolder = DriveApp.getFolderById(parentDir);
    var files = backupFolder.getFilesByName(filename);
    if (files.hasNext())
    {
        file = files.next();
        // Set the file contents
        file.setContent(content);
        Logger.log("Updated existing file: " + filename);
    }
    else
    {
        // Create a new file with content
        file = backupFolder.createFile(filename, content);
        Logger.log("Created new file: " + filename);
    }
    return file;
}

function getData(url)
{
    var response = UrlFetchApp.fetch(url);
    return response.getContentText();
}

function parseDeck(deckContent)
{
    // Convert deck to JSON
    var deck = JSON.parse(deckContent);

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

    // Setup variables
    var decklist = new String();

    // Iterate through each card, parse & append to the decklist
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
    var decksFile = findOrCreateFile(config.backupDir, allDecks.username + ".json", allDeckData);

    // Iterate through the decks and retrieve each one
    for (const deck of allDecks.decks)
    {
        // Retrieve deck content
        var filename = deck.name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
        filename += "." + deck.id;
        var deckUrl = apiUrl + "decks/" + deck.id + "/small/?format=json";
        var deckContent = getData(deckUrl);

        // Save unmodified deck JSON, if requested
        if (config.saveAsJson)
        {
            findOrCreateFile(config.backupDir, filename + ".json", deckContent);
        }

        //  Parse JSON into decklist, if requested
        if (config.saveAsTxt)
        {
            var deckList = parseDeck(deckContent);
            findOrCreateFile(config.backupDir, filename + ".txt", deckList);
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