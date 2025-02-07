/**
 * VCR provides an REDIS instance we can use as database.
 * 
 * This function will return all users
 */

async function action(req, res, globalState) {
    try {
        const TEMPLATES_TABLENAME = 'TEMPLATES';
        const templates = await globalState.hgetall(TEMPLATES_TABLENAME);
        const parsedTemplates = Object.keys(templates).map((key) => {
            const data = JSON.parse(templates[key]);
            return { ...data };
        })
        res.send(parsedTemplates);
    } catch (ex) {
        console.log(ex)
        return res.status(500).json({
            message: 'Unexpected error'
        })
    }
}


module.exports = { action };