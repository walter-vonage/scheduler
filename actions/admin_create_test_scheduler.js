const { neru, Assets, Scheduler, State, Messages } = require('neru-alpha');
/**
 * Run twice per hour: at minute 15 and 45 - From Mon to Sat - From 6am to 8pm
 */
const EOS_CRONJOB = '15,45 6-20 * * 1-6';

async function action(req, res) {
    try {
        const session = neru.createSession();
        const scheduler = new Scheduler(session);
        let startAtDate = new Date();
        const schedulerDeleted = await scheduler.cancel('checkandsender').execute();
        console.log(schedulerDeleted);
        const schedulerCreated = await scheduler
            .startAt({
                id: 'checkandsender',
                startAt: startAtDate.toISOString(),
                callback: '/checkandsend',
                interval: {
                    cron: EOS_CRONJOB,
                    // ...until,
                },
            })
            .execute();
        console.log(schedulerCreated);
        res.status(200).json({
            message: 'Schedule started'
        });
    } catch (ex) {
        console.log('Admin create test scheduler error', ex)
    }
}

module.exports = { action };