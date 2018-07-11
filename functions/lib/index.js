"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require('firebase-admin');
const functions = require('firebase-functions');
const gcs = require('@google-cloud/storage')();
const XLSX = require('xlsx');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { dialogflow, Suggestions } = require('actions-on-google');
admin.initializeApp(functions.config().firebase);
const db = admin.firestore();
const app = dialogflow({ debug: true });
app.intent("Who is the MP of constituency", (conv) => {
    console.log("Intent: ", conv.action);
    const constituency = conv.parameters['constituency'];
    return db.collection('loksabha-ministers').where('constituency', '==', constituency).limit(1).get()
        .then((snapshot) => {
        if (snapshot.length === 0) {
            conv.close("An error occured");
            console.error('<pt12> an error occured');
            return;
        }
        return snapshot.forEach(doc => {
            if (!doc.exists) {
                conv.close("An error occured");
                console.log('<pt13> document does not exist');
                return;
            }
            const data = doc.data();
            conv.ask(`${data['name']}, ${data['age']} from ${data['partyFull']} is the current loksabha MP from ${constituency}`);
            return conv.ask("Would you like to know more about the MP?", new Suggestions("Know More"));
        });
    }).catch((err) => {
        conv.close("An error occured");
        console.error("<pt14> no MP found", constituency);
        return;
    });
});
app.intent("Who is the MP of constituency - yes", (conv) => {
    console.log("Intent: ", conv.action);
    const oldContext = conv.contexts.get('whoisthempofconstituency-followup');
    const constituency = oldContext.parameters['constituency'];
    return db.collection('loksabha-ministers').where('constituency', '==', constituency).limit(1).get()
        .then((snapshot) => {
        if (snapshot.length === 0) {
            conv.close("An error occured");
            console.error('<pt12> an error occured');
            return;
        }
        return snapshot.forEach(doc => {
            if (!doc.exists) {
                conv.close("An error occured");
                console.log('<pt13> document does not exist');
                return;
            }
            const data = doc.data();
            conv.ask(`${data['name']} is the MP from ${data['constituency']}, ${data['state']}. 
                He is a member of ${data['partyFull']} and his education qualifications are: ${data['edu']}.
                He holds ${data['attendance']} attendance, with taking part is ${data['debates']} debates, raising ${data['questions']} questions and ${data['private_bills']} private bills.
                At age ${data['age']} he is a member of ${data['standing_comittee']} standing comittee`);
            return conv.ask("Would you like to know more about the MP?", new Suggestions("Know More"));
        });
    }).catch((err) => {
        conv.close("An error occured");
        console.error("<pt14> no MP found", constituency);
        return;
    });
});
// Updations 
function updateLokSabha(fileName) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Updating Lok Sabha");
        const dic = {
            'First': 1,
            'Second': 2,
            'Third': 3,
            'Fourth': 4,
            'Fifth': 5,
            'Sixth': 6,
            'Seventh': 7,
            'Eight': 8,
            'Ninth': 9
        };
        const bucket = gcs.bucket('shabha-app.appspot.com');
        const tempFilePath = path.join(os.tmpdir(), fileName);
        const res = yield bucket.file('assets/' + fileName).download({
            destination: tempFilePath,
        });
        const lsMP_ref = db.collection('loksabha-ministers');
        const workbook = yield XLSX.readFile(tempFilePath);
        const sheet_name_list = workbook.SheetNames;
        const xlData = yield XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
        for (let i = 0; i < xlData.length; i++) {
            const mp = xlData[i];
            let newRef = yield lsMP_ref.doc();
            if (mp['Constituency'] !== '' && mp['End of term'] === "In office") {
                try {
                    const rfp = yield newRef.set({
                        name: mp['MP name'],
                        nature: mp['Nature of membership'],
                        term: dic[mp['No. of Term']],
                        standing_committee: mp['Standing Committee Membership'],
                        state: mp['State'],
                        constituency: mp['Constituency'],
                        partyFull: mp['Political party'],
                        gender: mp['Gender'] === 'Male' ? 0 : 1,
                        edu: mp['Educational qualifications - details'],
                        age: mp['Age'],
                        debates: mp['Debates'],
                        private_bills: mp['Private Member Bills'],
                        questions: mp['Questions'],
                        attendance: mp['Attendance']
                    });
                }
                catch (err) {
                    console.log(mp['MP name'], err);
                }
                ;
            }
        }
        return fs.unlinkSync(tempFilePath);
    });
}
exports.redoInit = functions.firestore.document('server/current').onUpdate((change, context) => {
    const dataOld = change.before.data();
    const data = change.after.data();
    const redo = data['count'] !== dataOld['count']; // force
    if (redo) {
        return updateLokSabha(change.after.data()['loksabha-ministers-db']);
    }
    else if (dataOld['loksabha-ministers-db'] !== data['loksabha-ministers-db']) {
        return updateLokSabha(change.after.data()['loksabha-ministers-db']);
    }
    else {
        console.warn("Unknown field changed");
        return 0;
    }
});
exports.gActions = functions.https.onRequest(app);
//# sourceMappingURL=index.js.map