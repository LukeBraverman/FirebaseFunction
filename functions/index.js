// The Cloud Functions for Firebase SDK to create Cloud Functions and triggers.
const {onDocumentUpdated,onDocumentCreated} = require("firebase-functions/v2/firestore");
const admin = require('firebase-admin');
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

initializeApp();


const saveAuthorToDatabase = async (authorId, authorObjectToAdd ) => {
    await getFirestore()
        .collection("authors")
        .doc(authorId)
        .set(authorObjectToAdd);
}

const getIdFromBackLink = (backLinkToUse) => {
    let parts = backLinkToUse.split('/');
    const idFromBackLink = parts[2];
    return idFromBackLink;
}

exports.onBookAdd = onDocumentCreated("/books/{documentId}", async (event) => {

    const newlyAddedBook = event.data.data();
    const listOfAuthorsFromAddedBook = newlyAddedBook.authorIDs;

    if (!listOfAuthorsFromAddedBook || listOfAuthorsFromAddedBook.length === 0 ) return;

    const idOfNewlyAddedBook =  event.params.documentId;

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

exports.onBookUpdate = onDocumentUpdated("/books/{documentId}", async (event) => {

    const idOfNewlyUpdatedBook =  event.params.documentId;

    const updatedBook = event.data.after.data();
    const newAuthorIDs = updatedBook.authorIDs

    const outdatedBook = event.data.before.data();
    const oldAuthorIDs = outdatedBook.authorIDs

    const authorsToRemove = oldAuthorIDs.filter(authorId => !newAuthorIDs.includes(authorId));
    const authorsToAdd = newAuthorIDs.filter(authorId => !oldAuthorIDs.includes(authorId));

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
