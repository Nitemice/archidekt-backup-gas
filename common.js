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

function findOrCreateFile(parentDir, filename)
{
    // See if there's already a file in the indicated Google Drive folder
    var folder = DriveApp.getFolderById(parentDir);
    var files = folder.getFilesByName(filename);
    if (files.hasNext())
    {
        return files.next();
    }
    else
    {
        // Create a new empty file
        Logger.log("Created file: " + filename);
        return folder.createFile(filename, "");
    }
}

function updateOrCreateFile(parentDir, filename, content)
{
    var file = findOrCreateFile(parentDir, filename);

    // Check if the contents already matches
    if (file.getBlob().getDataAsString() != content)
    {
        // Set the file contents
        file.setContent(content);
        Logger.log("Updated file: " + filename);
    }
    // else
    // {
    //     Logger.log("No need to update file: " + filename);
    // }
    return file;
}

////////////////////////////////////////////////////