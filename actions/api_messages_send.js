
/**
 * Added Feb 7 2025
 * goal: To be able to send a payload with the following interface
 * {
 *      "message_type": "text",
 *      "templateId": number,
 *      "channel": "sms" | "rcs",
 *      "from": string,
 *      "to": string,
 *      "data": Array<{ string: string }>
 * }
 * 
 * This process will:
 *  1) Validate input
 *      Return 400 (Bad Request) if anything is missing or format is incorrect
 *  2) Find the template ID 
 *      Return 404 if template is not found
 *  3) Send the message
 *      Return 200 is all goes well.
 *  4) In case of unexpected error, return error 500
 */

const utils = require('../utils');
const sms = require('../services/sms')

async function action(req, res, globalState) {
    try {
        const { message_type, templateId, channel, from, to, data} = req.body;

        console.log(req.body)

        if (!globalState) {
            console.log('No global state');
            return;
        }

        if (!message_type || !templateId || !channel || !from || !to || !data) {
            console.log('Invalid input', req.body);
            returnInvalidInput(res);
            return;
        }

        if (message_type != 'text') {
            console.log('Message Type is not text');
            returnInvalidInput(res);
            return;
        }

        if (channel != "sms" && channel != "rcs") {
            console.log('Channel must be sms or rcs');
            returnInvalidInput(res);
            return;
        }

        const arrayOfValues = data;
        if (!arrayOfValues || !Array.isArray(arrayOfValues) || data.length == 0) {
            console.log('data is not an array');
            returnInvalidInput(res);
            return;
        }

        const template = await utils.getTemplateById(templateId, globalState);
        if (!template || !template.text) {
            console.log('Message Send - Template not found')
            return res.status(404).json({
                message: 'Template not found'
            })
        }

        let text = template.text;
        const record = data[0]; // We use the first element of the array for all the key:value
        const regexp = /\{\{\s?([\w\d]+)\s?\}\}/g;
        const matchArrays = [...text.matchAll(regexp)];            
        matchArrays.forEach((array) => {
            text = text.replaceAll(array[0], record[array[1]] || ""); // Replace with value or empty string if undefined
        });        

        const templateIsRcs = template.rcsEnabled;
        const forceRcs = (channel == 'rcs') ? true : false;
        const useRcs = templateIsRcs || forceRcs;

        console.log('This is the text to send:' + text)
        console.log('Use RCS:', useRcs)

        const result = await sms.sendSmsOrRcsLight(from, to, text, useRcs);

        console.log('Message sent', result)
        res.status(200).json({
            message: 'Message sent'
        })

    } catch(ex) {
        console.log(ex)
        return res.status(500).json({
            message: 'Unexpected error'
        })
    }
}


function returnInvalidInput(res) {
    res.status(400).json({
        message: `Invalid input. Expected 
        {
            "message_type": "text",
            "templateId": number,
            "channel": "sms" | "rcs",
            "from": string,
            "to": string,
            "data": Array<{ string: string }>
        }
        `
    })
}

module.exports = { action };