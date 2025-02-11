/**
 * VCR provides an REDIS instance we can use as database.
 * 
 * This function will create an Authorisation Token 
 * for sending requests via Postman
 * 
 * Body to send: 
 * {
 *      "password": string,
 * }
 */
const utils = require('../utils')

async function action(req, res, globalState) {
    try {
        const { password } = req.body;

        const token = await utils.createAuthorisationToken(globalState, password);
        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Unable to create authorisation token'
            })    
        }

        return res.status(200).json({
            success: true,
            message: 'Record created',
            token
        })

    } catch (ex) {
        console.log(ex)
        return res.status(500).json({
            success: false,
            message: 'Unexpected error'
        })
    }
}

module.exports = { action };