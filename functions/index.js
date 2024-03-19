// The Cloud Functions for Firebase SDK to create Cloud Functions and triggers.
const {onDocumentUpdated,onDocumentCreated} = require("firebase-functions/v2/firestore");
const admin = require('firebase-admin');
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {onRequest} = require("firebase-functions/v2/https");

initializeApp();
const db = admin.firestore();
const saveAuthorToDatabase = async (authorId, authorObjectToAdd ) => {
    await getFirestore()
        .collection("authors")
        .doc(authorId)
        .set(authorObjectToAdd);
}

const getIdFromReference = (reference) => {
    const idFromReference = reference._path.segments[1];
    return idFromReference;
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
exports.addBook = onRequest(async (req, res) => {
    // Grab the text parameter.
    // Push the new message into Firestore using the Firebase Admin SDK.
    const authorRef = db.doc('/authors/author2');
    const authorRef2 = db.doc('/authors/author1');

    const bookObj = {
        authorIDs: [],
        title: 'It'
    }
    const addBook = await getFirestore()
        .collection("books")
        .doc('book1')
        .set(bookObj);
    // Send back a message that we've successfully written the message
    res.json({result: `New book added`});
});


exports.onBookAdd = onDocumentCreated("/books/{documentId}", async (event) => {

    const newlyAddedBook = event.data.data();

    const listOfAuthorsFromAddedBook = newlyAddedBook.authorIDs;

    if (!listOfAuthorsFromAddedBook || listOfAuthorsFromAddedBook.length === 0 ) return;

    const idOfNewlyAddedBook =  event.params.documentId;

    for (i = 0; i < listOfAuthorsFromAddedBook.length; i++)
    {
        // new code
        const authorsReference = listOfAuthorsFromAddedBook[i];

        let authorId = getIdFromReference(authorsReference)
        //

        const docSnapshot = await getFirestore()
            .collection('authors').doc(authorId).get()

        if (!docSnapshot || !docSnapshot.exists) return;

        let authorData = docSnapshot.data();

        // new code
        const newBookReference = db.doc('/books/' + idOfNewlyAddedBook);

        authorData.bookIDs.push(newBookReference)

        await saveAuthorToDatabase(authorId, authorData);

    }
});

exports.onBookUpdate = onDocumentUpdated("/books/{documentId}", async (event) => {

    const idOfNewlyUpdatedBook =  event.params.documentId;

    const updatedBook = event.data.after.data();
    const newAuthorRefs = updatedBook.authorIDs; // Assuming authorIDs are now Firebase document references

    const outdatedBook = event.data.before.data();
    const oldAuthorRefs = outdatedBook.authorIDs; // Assuming authorIDs were previously string IDs

    // Find authors to remove
    const authorsToRemove = oldAuthorRefs.filter(oldRef => !newAuthorRefs.some(newRef => newRef.isEqual(oldRef)));

    // Find authors to add
    const authorsToAdd = newAuthorRefs.filter(newRef => !oldAuthorRefs.some(oldRef => oldRef.isEqual(newRef)));

    if (authorsToAdd.length !== 0)
    {
        for (i=0; i < authorsToAdd.length; i++)
        {
            let authorReference = authorsToAdd[i];
            // new code
            let authorId = getIdFromReference(authorReference)

            const docSnapshot = await getFirestore()
                .collection('authors').doc(authorId).get()

            if (!docSnapshot || !docSnapshot.exists) return;

            let authorData = docSnapshot.data();

            // new code
            const newBookReference = db.doc('/books/' + idOfNewlyUpdatedBook);

            authorData.bookIDs.push(newBookReference)

            await saveAuthorToDatabase(authorId, authorData);

        }
    }

    if(authorsToRemove.length !== 0)
    {            console.log('99 Decided to remove')

        for (i=0; i < authorsToRemove.length ; i++)
        {

            let authorReference = authorsToRemove[i];

            // new code
            let authorId = getIdFromReference(authorReference)

            const docSnapshot = await getFirestore()
                .collection('authors').doc(authorId).get()
            if (!docSnapshot || !docSnapshot.exists) return;

            let authorData = docSnapshot.data();

            // new code
            const docPathToRemove = '/books/' + idOfNewlyUpdatedBook;

            authorData.bookIDs = authorData.bookIDs.filter(bookLink => {
                const restoredPath = '/books/' + getIdFromReference(bookLink)
                return restoredPath !== docPathToRemove
            });

            await saveAuthorToDatabase(authorId, authorData);

        }
    }
})
