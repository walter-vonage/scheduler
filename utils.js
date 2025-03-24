const { DateTime } = require('luxon');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const checkSenderIdValid = (senderId) => /^[a-zA-Z0-9]*$/gm.test(senderId);
const { tokenGenerate } = require('@vonage/jwt');
const fetch = require('node-fetch');
const constants = require('./constants');
const privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC2k8VMI3hdl8Iz
ey84Hrp5wSwTVF7oH0ArheTZbDWswLhtbbbEH/NM7tyRWV+7RF0O7QdobLSTxPsW
R9veKBUYVh5SKW8MmCQGktFuFY9fAGrdRQUfWPww+7t1ffeYn61GdTqj20fpJcAm
RSpYG4FvElUYntvKLLU+c5VjwvK1TrFslTL+m6+zbRt6lCbNldSTGwC/bx/uhQLf
tayL1yr5BdaPW7kJ8aME009Ta8tT1cpJJmL48HDhqh91mKJeW8c/yF3SX159vJ0D
AJkmqygZ6VjukWCoYdnbSVhBelyZ1YQ7QC6FWX6XotbraAW4pSeS4wecx8AyyrU+
qQLblkjbAgMBAAECggEAF4Wg4kGiR5HpB9o+Unadrliq0Fq1rNDJ4vw/EvE+q7Zb
Nw3u1q8Jw3Gf98HnSX3HQh2w2ffsqSpe8Zc/G7dXmxO37ac/kq8khQxJRcDVVcyn
TUE6ew1rKvcORwF8SAIvwBITr09C9ntR7sbzwPeE4hsfMirVRON5qPAZ4QkZXS5B
QPKLHX3iZatehIFb42O1BencCZUT4geNWzb6qsdr6ebnWQQ29JFrVDT+QU2TvVZm
a+/rPu6yd9LcxYED8VEUE6gYiO5WkJv318jg6XDZib9IBnutBm2wZpbiuZ6d3xiV
EtPYrxrG0JA2lHtyhNLPBaAl00EP5lbxRUQNztVQMQKBgQD7NdQfRH94ttKX5GzC
o3rwBKXKGeaNFEpzVFSnoQ+zwFCBDdoRQ1a3rX7q+S1MXVP3W9h9EmbXusecSxN3
5evJkwu/OOz/IScYXRl2zffRonceYtwo9P3CBq8Eng5NAaqvgbW2EIGM7tEQv016
72qOsngZJFnRCZ4P4VASOgVpLQKBgQC6DvC849xN11Zo/WLoPCXBRpfrxhAo4a8w
cDj10z+SWRCo40AgBUEyMx46E+hGetGC+T1tycaerK0M9+7bcnGQ0x3MePANnGvd
g0F8d6d2kTagfOu/WShrOL2J5Txp5Tn3KmyCWi2w1edyysGS4iG4LHb0bmWhzYru
nGSCgMQvJwKBgQCeTLNY6L8zAHIAiU8H8CC+Mw+OJXglGs43ksKtx06vxNZ2HJZ4
Hmj84fWCeHbVElKhI11uozPvaaHzmVOxUE+e/GyAmYyu0ONj9Pbg6LXrgmdx3HZD
0O4/YBrV3AvC9vPqGOC60/fvKWbRGNvoRgpt1YTcww1eLqNN+nuMoMdcGQKBgAur
ykAfDv+3BU2ar2yf8UJZekgo6XSXC5U/RONut+snORtO/gPEMJ3EhR3hh818AM51
cfwEDzh+3nAU0V/koukRxSnBYFWKPV3s0NvM6a1PWJzimSssnZN0QLd4sLx3y5YM
jDf1Di6sjFMwEspy8uiJqYCVuDxZF2D2YHurNiM7AoGBAOOnjoQlos7p7PzhDjtR
RrU4WZoxOtkO+2YqYPBgdOu5BZW43zth+w4BX2UUx3SDMqiKDFD+NjPggo+Kb3lF
T5pWwUBN7V74SKSJbXqjs12fyiiJV0hwiJeNGP71334o5DoL6b9rCdiuzHcigfwk
gRQFycx162oCXV9pPaTx6vXz
-----END PRIVATE KEY-----`;
const applicationId = `4fae40f2-e5f8-4275-9968-c45d7a03eed0`;
const rcsAgent = 'VonageLondon-CSM';

const { v4: uuidv4 } = require('uuid');

const getUsers = async (globalState) => {
    try {
        const users = await globalState.hvals('users');
        return users;
    } catch (ex) {
        console.log('validateTokenBasedOnPassword', ex)
        return [];
    }
}

/**
 * Based on the first password (stored in DB)
 * We generate tokens.
 */
const getTokenBasedOnPassword = async () => {
    try {

    } catch (ex) {
        console.log('getTokenBasedOnPassword', ex)
        return null;
    }
}

/**
 * For Postman requests you need to send an Authorisation Token.
 * This function will validate if the token exists or not.
 */
const validateAuthTokenFromRequest = async (globalState, req) => {
    try {
        const authHeader = req.headers['authorization'];
        let token;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1]; // Extract the token after 'Bearer '
        } else {
            token = null;
        }
        const value = await validateAuthToken(globalState, token)
        return value;
    } catch (ex) {
        console.log('validateAuthToken', ex)
        return false;
    }
}
const validateAuthToken = async (globalState, token) => {
    try {
        const storedToken = await await globalState.hvals('authTokens');
        console.log(storedToken)
        for (let item of storedToken) {
            const value = JSON.parse(item)
            if (value.token == token) {
                return true;
            }
        }
        return false;
    } catch (ex) {
        console.log('validateAuthToken', ex)
        return false;
    }
}


const createAuthorisationToken = async (globalState, password) => {
    try {
        if (!password) {
            console.log('createAuthorisationToken - no passowrd sent');
            return null;
        }

        const users = await getUsers(globalState)
        console.log(users)
        if (!users) {
            console.log('createAuthorisationToken - no users found');
            return null;
        }

        let passwordFound = false;
        for (let item of users) {
            const u = JSON.parse(item)
            if (u.password == password) {
                passwordFound = true;
                break;
            }
        }

        if (!passwordFound) {
            console.log('createAuthorisationToken - Invalid passowrd sent');
            return null;
        }

        const token = uuidv4();

        await globalState.hset('authTokens', {
            [password]: JSON.stringify({
                token,
            }),
        })

        return token;

    } catch (ex) {
        console.log('createAuthorisationToken', ex)
        return null;
    }
}



const getTemplateById = async (templateId, globalState) => {
    try {
        const TEMPLATES_TABLENAME = 'TEMPLATES';
        const templates = await globalState.hgetall(TEMPLATES_TABLENAME);
        const parsedTemplates = Object.keys(templates).map((key) => {
            const data = JSON.parse(templates[key]);
            return { ...data };
        })
        console.log('parsedTemplates', parsedTemplates)
        const template = parsedTemplates.find((template) => template.id == templateId);
        console.log('Template found', template)
        return template;
    } catch (ex) {
        console.log('getTemplateById', ex)
        return null;
    }
}

const secondsTillEndOfDay = () => {
    const now = DateTime.now().setZone('Europe/Berlin');
    const germanTime = DateTime.fromObject({ day: now.c.day, hour: 20, minute: 0, second: 0 }, { zone: 'Europe/Berlin' });
    const diffSeconds = parseInt((germanTime - now) / 1000);
    return diffSeconds;
};
const timeNow = () => {
    const now = DateTime.now().setZone('Europe/Berlin');
    return now.c.hour;
};

const generateToken = () => {
    console.log('Generating token with App Id: ' + applicationId)
    return tokenGenerate(applicationId, privateKey, {
        exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60, // 8 hours
    });
};
const checkRCS = async (to) => {
    const host = 'https://api.nexmo.com';
    const token = generateToken();

    const response = await fetch(`${host}/v1/channel-manager/rcs/agents/${rcsAgent}/google/phones/${to}/capabilities`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
        
    // Convert the response to JSON
    const data = await response.json();
    
    // Print the actual response data
    console.log(data);
    
    //  Checks for 200
    if (response.ok) {
        return true;
    }

    return false;
};

const writeResults = async (results, path, header) => {
    const csvWriter = createCsvWriter({
        fieldDelimiter: ';',
        path: path,
        header: header,
    });
    // if (results.length) {
    csvWriter
        .writeRecords(results) // returns a promise
        .then(() => {
            console.log('...Done');
        })
        .catch((e) => console.log(`Something wrong while writting the output csv ${e}`));
};

const moveFile = (assets, pathFrom, pathTo, records, filename) => {
    return new Promise(async (res, rej) => {
        try {
            await writeResults(records, pathFrom, constants.processedFileHeader);
            console.log('uploading file to processed folder');

            await assets.uploadFiles([pathFrom], pathTo).execute();
            console.log('removing file from send folder' + filename);
            await assets.remove(filename).execute();
            res();
        } catch (e) {
            console.log(`Something wrong while moving the csv file ${e}`);
            rej(e);
        }
    });
};

// function checkAuthenticated(req, res, next) {
//   if (req.isAuthenticated()) {
//     return next();
//   }

//   res.redirect('/login');
// }

const checkAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
};

const checkNotAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return res.redirect('/templates/new');
    }
    next();
};

module.exports = {
    checkSenderIdValid,
    secondsTillEndOfDay,
    writeResults,
    moveFile,
    checkAuthenticated,
    checkNotAuthenticated,
    timeNow,
    checkRCS,
    generateToken,
    rcsAgent,
    getTemplateById,
    getUsers,
    createAuthorisationToken,
    validateAuthTokenFromRequest,
};
