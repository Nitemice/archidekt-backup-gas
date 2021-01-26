var common = {

    grabJson: function(id)
    {
        var file = DriveApp.getFileById(id).getAs("application/json");
        return JSON.parse(file.getDataAsString());
    },

    saveJson: function(id, content)
    {
        var file = DriveApp.getFileById(id);
        // Set the file contents
        file.setContent(JSON.stringify(content));
    },

    findOrCreateFolder: function(parentDir, foldername)
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
    },

    findOrCreateFile: function(parentDir, filename)
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
    },

    updateOrCreateFile: function(parentDir, filename, content)
    {
        var file = common.findOrCreateFile(parentDir, filename);

        // Check if the contents already matches
        if (file.getBlob().getDataAsString() != content)
        {
            // Set the file contents
            file.setContent(content);
            Logger.log("Updated file: " + filename);
        }
        return file;
    },

    parsePathParameters: function(request)
    {
        // If there's only one parameter, just treat it as a path
        if (!request.queryString.match(/\=/))
        {
            return request.queryString;
        }

        // Look for a parameter called "path"
        return request.parameter.path || "";
    },

    // Strip spaces, no-break spaces, zero-width spaces,
    // & zero-width no-break spaces
    trim: function(string)
    {
        var pattern = /(^[\s\u00a0\u200b\uFEFF]+)|([\s\u00a0\u200b\uFEFF]+$)/g;
        return string.replace(pattern, "");
    },

    // Retrieve text from inside XML tags
    stripXml: function(input)
    {
        // Only parse input if it looks like it contains tags
        if (input.match(/<[^>]*>/))
        {
            var doc = XmlService.parse(input);
            return doc.getRootElement().getText();
        }
        return input;
    },

    prettyPrintJsonStr: function(input)
    {
        return JSON.stringify(JSON.parse(input), null, 4);
    },
    
    ////////////////////////////////////////////////////
}