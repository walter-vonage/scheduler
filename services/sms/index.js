// eslint-disable-next-line no-control-regex

const axios = require('axios');
// column name of csv file that contains the template ID
const CSV_TEMPLATE_ID_COLUMN_NAME = 'ID_SMSTEXT';
// column name of csv file that contains the phone number of the receiver
const CSV_PHONE_NUMBER_COLUMN_NAME = 'MOBILTELEFONNUMMER';
// column name of csv file that contains the ID that will be put into account_ref (together with csv filename)
const CSV_ID_COLUMN_NAME = 'ID';
// column name of csv file that contains the ID that will be put in the client_ref field
const rateLimiterService = require('../rateLimiter/index');
const tps = parseInt(process.env.tps || '30', 10);
const rateLimitAxios = rateLimiterService.newInstance(tps);
const utils = require('../../utils');
const blackListService = require('../blacklist/index');
// neru tablename for processed filenames
const api_url = 'https://api.nexmo.com/v1/messages';

const sendAllMessages = async (records, filename, globalState) => {
    const csvName = filename.split('send/')[1];
    try {
        let smsCount = 0;
        let rcsCount = 0;
        let blackListed = 0;
        const promises = records.map(async (record) => {
            try {
                const result = await sendMessage(record, csvName, globalState);
                const client_ref_obj = { client_ref: client_ref };
                // Increment SMS or RCS count based on the channel
                if (result.channel === 'sms') smsCount++;
                if (result.channel === 'rcs') rcsCount++;
                if (result.channel === 'blacklist') blackListed++;

                return Promise.resolve(Object.assign({}, result, client_ref_obj));
            } catch (error) {
                return Promise.reject(error);
            }
        });
        const results = await Promise.all(promises);
        // Add SMS and RCS counts to results summary
        results.push({ smsCount, rcsCount, blackListed });
        return results;
    } catch (error) {
        console.error(error);
        return error;
    }
};

const sendMessage = async (record, csvName, globalState) => {
    try {
        const templateId = record[CSV_TEMPLATE_ID_COLUMN_NAME];
        const template = await utils.getTemplateById(templateId, globalState);
        let text = template?.text;
        const rcsTemplate = template?.rcsEnabled;
        const viberEnabled = template?.viberEnabled;
        const senderNumber = `${record[`${template?.senderIdField}`]?.replaceAll('+', '')}`;
        const to = `${record[CSV_PHONE_NUMBER_COLUMN_NAME]?.replaceAll('+', '')}`;
        const client_ref = record[CSV_ID_COLUMN_NAME];

        const regexpCurly = /\{\{\s?([\w\d]+)\s?\}\}/g;
        const regexpDoublePercent = /%%([\w\d]+)%%/g;

        if (text) {
            //  Replace all {{PLACEHOLDER}}
            const matchArrays = [...text.matchAll(regexpCurly)];
            matchArrays.forEach((array) => {
                text = text.replaceAll(array[0], record[`${array[1]}`]);
            });

            //  Replace all %%PLACEHOLDER%%
            const matchArraysDoublePercent = [...text.matchAll(regexpDoublePercent)];
            matchArraysDoublePercent.forEach((array) => {
                text = text.replaceAll(array[0], record[`${array[1]}`]);
            });
        }
        let channel = 'sms';
        if (rcsTemplate) channel = 'rcs';
        if (viberEnabled) channel = 'viber_service'
        const result = await sendMessageViaAnyChannel(channel, senderNumber, to, text, api_url, client_ref = '', csvName = '', rateLimitAxios);
        return result;
    } catch(ex) {
        console.log('sendMessage error', ex)
        return null;
    }
}


const sendOptOutRcs = async (senderNumber, to) => {
    const headers = {
        Authorization: `Bearer ${utils.generateToken()}`, // Use the JWT token parameter
        'Content-Type': 'application/json',
    };
    const body = {
        message_type: 'text',
        from: senderNumber,
        channel: 'rcs',
        to: to,
        text: 'You have been opted out. You will not receive more messages',
        sms: { encoding_type: 'auto' },
        client_ref: `opt-out`,
    };
    try {
        const response = await axios.post(api_url, body, { headers });
        return {
            ...response.data,
            // Include the channel in the returned object
        };
    } catch (error) {
        console.error(error.response.data);
        return { ...error.response.data, channel };
        // return Promise.reject(error);
    }
};

const sendMessageViaAnyChannelLight = async (channel, senderNumber, to, text) => {
    return await sendMessageViaAnyChannel(channel, senderNumber, to, text, api_url, null, null, rateLimitAxios);
}

const sendMessageViaAnyChannel = async (channel = 'sms', senderNumber, to, text, apiUrl, campaignName = '', csvName = '', axios) => {
    
    const isBlackListed = await blackListService.isBlackListed(to);
    if (isBlackListed) {
        return {
            message_id: 'Blacklisted number - User sent STOP',
            channel: 'blacklist',
        };
    }
    
    let from = senderNumber || 'test';

    const headers = {
        Authorization: `Bearer ${utils.generateToken()}`, // Use the JWT token parameter
        'Content-Type': 'application/json',
    };

    if (channel == 'rcs') {
        const isRcsSupported = await utils.checkRCS( from, to );
        console.log('sendMessageViaAnyChannel - isRcsSupported', isRcsSupported)
        channel = isRcsSupported ? 'rcs' : 'sms';
    }

    if (channel == 'viber_service') {
        if (!process.env.VIBER_SERVICE_MESSAGE_ID) {
            console.log('sendMessageViaAnyChannel - Unable to send Viber since NO VIBER SERVICE ID FOUND')
            return null;
        } else {
            from = process.env.VIBER_SERVICE_MESSAGE_ID;
        }
    }

    //  SMS or RCS or VIBER
    let body = {
        message_type: 'text',
        from,
        channel,
        to,
        text,
        sms: { 
            encoding_type: 'auto' 
        },
        client_ref: `${campaignName || 'no-campaign'}-${csvName || 'no-csv'}`
    }

    try {
        const response = await axios.post(apiUrl, body, { headers });
        return {
            ...response.data,
            channel, // Include the channel in the returned object
        };
    } catch (error) {
        console.error(error.response.data);
        if (error.response != null && error.response.status === 429) {
            console.log('Too many requests (429), retrying...');
        }
        return { ...error.response.data, channel };
    }
};



module.exports = {
    sendAllMessages,
    sendOptOutRcs,
    sendMessage,
    sendMessageViaAnyChannel,
    sendMessageViaAnyChannelLight,
};
