// The Cloud Functions for Firebase SDK to create Cloud Functions and triggers.
const {logger} = require("firebase-functions");
const {onRequest} = require("firebase-functions/v2/https");
const {onDocumentUpdated,onDocumentCreated} = require("firebase-functions/v2/firestore");
const admin = require('firebase-admin');

// The Firebase Admin SDK to access Firestore.
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

initializeApp();

// NOTE: THIS FILE IS OUTDATED
/*
This helper function takes in an author ID and a author object to save in a connected firestore database.
 */
const saveAuthorToDatabase = async (authorId, authorObjectToAdd ) => {
    await getFirestore()
        .collection("authors")
        .doc(authorId)
        .set(authorObjectToAdd);
}

/*
This helper function takes in a string in the form /{collectionName}/{documentID}
It will then extract and return the documentID, using string manipulation
 */
const getIdFromBackLink = (backLinkToUse) => {
    let parts = backLinkToUse.split('/');
    const idFromBackLink = parts[2];
    return idFromBackLink;
}
/*
This is a test function to call at the start, when testing. It will add some fake author data to the database.
 */
exports.seedData = onRequest(async (req, res) => {
    const authorObj = {
        bookIDs: [],
        full_name: 'Stephen King - THIS SHOULD BE THE OBJ RETURNED'
    }

    const bookObj = {
        authorIDs: ['/authors/author1'],
        title: 'Carrie'
    }
    const addAuthor = await getFirestore()
        .collection("authors")
        .doc('author1')
        .set(authorObj);

    res.json({result: `Data added to database.`});
});

/*
This is a test function to call when testing. It will add a fake book to the database.
We will then beable to see if the functions below correctly react to a new book addition.
 */
exports.addBookR = onRequest(async (req, res) => {
    // Grab the text parameter.
    // Push the new message into Firestore using the Firebase Admin SDK.
    const authorRef = db.doc('/authors/author2');
    const bookObj = {
        authorIDs: [authorRef],
        title: 'It'
    }
    const addBook = await getFirestore()
        .collection("books")
        .doc('book2')
        .set(bookObj);
    // Send back a message that we've successfully written the message
    res.json({result: `New book added`});
});

// This function listens for a new book to be created
exports.onBookAdd = onDocumentCreated("/books/{documentId}", async (event) => {
    // This will get the new book data and store as a object
    const newlyAddedBook = event.data.data();
    // This will get the list of authors
    const listOfAuthorsFromAddedBook = newlyAddedBook.authorIDs;
    console.log('Now References -> '+ listOfAuthorsFromAddedBook)
    const firstRef = listOfAuthorsFromAddedBook[0];
    console.log('FirstRef -> '+ firstRef)
    return;
    // If there are no authors then return early
    if (!listOfAuthorsFromAddedBook || listOfAuthorsFromAddedBook.length === 0 ) return;
    // We can get the ID of the new book from the path variable on line 74 ("/books/{documentId}").
    // this is done on line 83
    const idOfNewlyAddedBook =  event.params.documentId;

    // we loop through the list of authors from the newly added book
    // for each author we need to check if they are in our database. If they are, we add a backlink with our book ID.
    for (i = 0; i < listOfAuthorsFromAddedBook.length; i++)
    {
        const authorBacklink = listOfAuthorsFromAddedBook[i];

        let authorId = getIdFromBackLink(authorBacklink)

        const docSnapshot = await getFirestore()
            .collection('authors').doc(authorId).get()

        if (!docSnapshot || !docSnapshot.exists) return;

        let authorData = docSnapshot.data();

        const newBookBacklink = '/books/' + idOfNewlyAddedBook

        authorData.bookIDs.push(newBookBacklink)

        await saveAuthorToDatabase(authorId, authorData);

    }
});

// this function listens for a update on a book allready in the database
exports.onBookUpdate = onDocumentUpdated("/books/{documentId}", async (event) => {

    // we get the id of the book from the path variable defined on line 110
    const idOfNewlyUpdatedBook =  event.params.documentId;

    // We need to get the list of authorIDs from before and after the update.
    // IF an author was in the list AND THEN removed, we need to find the author in the database and remove the book backlink from their datastore
    // IF an author was NOT in the list AND THEN ADDED, we need to find the author in the database and add the book backlink to the datastore.
    const updatedBook = event.data.after.data();
    const newAuthorIDs = updatedBook.authorIDs

    const outdatedBook = event.data.before.data();
    const oldAuthorIDs = outdatedBook.authorIDs

    // This will find all the authors that were in the array before the update, but were removed
    const authorsToRemove = oldAuthorIDs.filter(authorId => !newAuthorIDs.includes(authorId));
    // This will find all the authors that were NOT in the array before the update, and were added
    const authorsToAdd = newAuthorIDs.filter(authorId => !oldAuthorIDs.includes(authorId));

    // for all the authors that were added, we find them in the database and add the book backlink to their datastore
    if (authorsToAdd.length !== 0)
    {
        for (i=0; i < authorsToAdd.length; i++)
        {
            let authorBackLink = authorsToAdd[i];
            let authorId = getIdFromBackLink(authorBackLink)

            const docSnapshot = await getFirestore()
                .collection('authors').doc(authorId).get()

            if (!docSnapshot || !docSnapshot.exists) return;

            let authorData = docSnapshot.data();
            const newBookBacklink = '/books/' + idOfNewlyUpdatedBook

            authorData.bookIDs.push(newBookBacklink)

            await saveAuthorToDatabase(authorId, authorData);

        }
    }
    // for all the authors that were removed, we find them in the database and remove the book backlink to their datastore

    if(authorsToRemove.length !== 0)
    {
        for (i=0; i < authorsToRemove.length ; i++)
        {

            let authorBackLink = authorsToRemove[i];

            let authorId = getIdFromBackLink(authorBackLink)

            const docSnapshot = await getFirestore()
                .collection('authors').doc(authorId).get()
            if (!docSnapshot || !docSnapshot.exists) return;

            let authorData = docSnapshot.data();

            const bookBackLinkToRemove = '/books/' + idOfNewlyUpdatedBook

            authorData.bookIDs = authorData.bookIDs.filter(bookLink => bookLink !== bookBackLinkToRemove);

            await saveAuthorToDatabase(authorId, authorData);

        }
    }



})
