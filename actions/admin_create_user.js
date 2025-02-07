/**
 * VCR provides an REDIS instance we can use as database.
 * 
 * This function will create the first user 
 * if the database is empty.
 * 
 * Body to send: 
 * {
 *      "email": string,
 *      "password": string,
 *      "name": string,
 * }
 */

async function action(req, res, globalState) {
    try {
        const { email, password, name } = req.body;

        if (!email || !password || !name) {
            console.log('Invalid input', req.body);
            returnInvalidInput(res);
            return;
        }

        await globalState.hset('users', {
            [email]: JSON.stringify({
                id: uuidv4(),
                email,
                name,
                password,
            }),
        })

        return res.status(200).json({
            message: 'User created'
        })

    } catch (ex) {
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
            "email": string,
            "password": string,
            "name": string,
        }
        `
    })
}

module.exports = { action };