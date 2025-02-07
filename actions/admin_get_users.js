/**
 * VCR provides an REDIS instance we can use as database.
 * 
 * This function will return all users
 */

async function action(req, res, globalState) {
    try {
        const users = await globalState.hvals('users');
        res.send(users);
    } catch (ex) {
        console.log(ex)
        return res.status(500).json({
            message: 'Unexpected error'
        })
    }
}


module.exports = { action };