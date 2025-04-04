const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const cors = require('cors');
const flash = require('express-flash');
const methodOverride = require('method-override');
const passport = require('passport');
const tps = parseInt(process.env.tps || '30', 10);
const cookieSession = require('cookie-session');
const { neru, Assets, Scheduler, State, Messages } = require('neru-alpha');
const whitelistRouter = require('./router/whitelist');
const csvService = require('./services/csv');
const smsService = require('./services/sms');
const constants = require('./constants');
const keepAlive = require('./services/keepalivescheduler');
const utils = require('./utils');
const initializePassport = require('./passport-strategy');
const { default: axios } = require('axios');
const path = require('path');

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Neru / VCR
 */
const session = neru.getGlobalSession();
const globalState = new State(session);  // In debug this loses the data. Deploy is fine. Make sure your vcr.yml file contains "preserve-data: true" for debug

/**
 * Table name where templates are stored
 */
const TEMPLATES_TABLENAME = 'TEMPLATES';

/**
 * Run twice per hour: at minute 15 and 45 - From Mon to Sat - From 6am to 8pm
 */
const EOS_CRONJOB = '15,45 6-20 * * 1-6';

/**
 * Express settings
 */
app.use(cors());
app.use(flash());
app.use(
    cookieSession({
        name: 'session',
        keys: ['secretcat'],
        secure: false,
        resave: false,
        maxAge: 24 * 60 * 60 * 1000,
    })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride('_method'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');

/**
 * Using Passport to get session information
 * when users are logged in.
 */
initializePassport(
    passport,
    async (email) => {
        const customer = await globalState.hget('users', email);
        return JSON.parse(customer);
    },
    async (email) => {
        const customer = await globalState.hget('users', email);
        return customer;
    }
);

/**
 * Show root page
 */
app.get('/', utils.checkNotAuthenticated, async (req, res) => {
    const users = await utils.getUsers(globalState);
    if (users && Array.isArray(users) && users.length == 0) {
        //  Create first user
        res.render('templates/users-new', {});
    } else {
        //  Check if logged in
        res.redirect('/login');
    }
});

/**
 * Allows an authorised user to create 
 * Authorisation Tokens for sending requests via Postman
 */
app.get('/tokens', utils.checkNotAuthenticated, async (req, res) => {
    res.render('templates/tokens-new', {});
})

/**
 * Stores an Authorisation Token for sending requests via Postman.
 * For creating a record you need to send your user password
 */
app.post('/admin/tokens', async (req, res) => {
    const fn = require('./actions/admin_auth_token_create');
    fn.action(req, res, globalState);
})

app.get('/admin/tokens/validate', async (req, res) => {
    const valid = await utils.validateAuthTokenFromRequest(globalState, req);
    console.log( 'Is valid: ' + valid )
    res.status(200).json({
        valid
    })
})

/**
 * Removes a number from the black list
 */
app.use('/whitelist', whitelistRouter());

/**
 * Check system health 
 */
app.get('/_/health', async (req, res) => {
    res.sendStatus(200);
});

/**
 * VCR calls this to show metrics related stuff
 */
app.get('/_/metrics', async (req, res) => {
    res.sendStatus(200);
});

/**
 * Keep alive the neru app while writting files to avoid restarts.
 * 
 * This is useful to keep alive Neru if the customer is sending 
 * big files and takes long time. 
 */
app.get('/keepalive', (req, res) => {
    // console.log('keep alive ping');
    res.sendStatus(200);
});

/**
 * Show User login page
 */
app.get('/login', utils.checkNotAuthenticated, (req, res) => {
    res.render('templates/login', {});
});

/**
 * Perform login
 */
app.post(
    '/login',
    utils.checkNotAuthenticated,
    passport.authenticate('local', {
        successRedirect: '/templates/new',
        failureRedirect: '/login',
        failureFlash: true,
    })
);

// TEMPLATE VIEWS START

/**
 * Get a list of templates as ejs view
 */
app.get('/templates', utils.checkAuthenticated, async (req, res) => {
    const templates = await globalState.hgetall(TEMPLATES_TABLENAME);
    const parsedTemplates = Object.keys(templates).map((key) => {
        const data = JSON.parse(templates[key]);
        return { ...data };
    });
    res.render('templates/index', { templates: parsedTemplates });
});

/**
 * Get a form to create a new template
 */
app.get('/templates/new', utils.checkAuthenticated, async (req, res) => {
    res.render('templates/new', {});
});

/**
 * Edits an existing template
 * Mon 24 March
 */
app.get('/templates/edit/:id', utils.checkAuthenticated, async (req, res) => {
    const templateId = req.params.id;
    if (templateId) {
        const template = await utils.getTemplateById(templateId, globalState);
        if (template) {
            console.log('Template to edit', template)
            res.render('templates/edit', { template });
        }        
    } else {
        res.render('templates/new', {});
    }
});

// TEMPLATE VIEWS END

// TEMPLATE API START

/**
 * Get a list of all templates
 */
app.get('/api/templates', async (req, res) => {
    const validtoken = await utils.validateAuthTokenFromRequest(globalState, req);
    if (!validtoken) {
        return res.status(401).json({
            message: 'Invalid token'
        })
    }
    const templates = await globalState.hgetall(TEMPLATES_TABLENAME);
    const parsedTemplates = Object.keys(templates).map((key) => {
        const data = JSON.parse(templates[key]);
        return { ...data };
    });
    res.json(parsedTemplates);
});

/**
 * Check if any given phone number supports RCS
 */
app.get('/support/:phone/:senderId', async (req, res) => {
    const phone = req.params.phone;
    const senderId = req.params.senderId;
    if( phone && senderId) {
        const validtoken = await utils.validateAuthTokenFromRequest(globalState, req);
        if (!validtoken) {
            return res.status(401).json({
                message: 'Invalid token'
            })
        }
        const isRcsSupported = await utils.checkRCS( senderId, phone );
        console.log(isRcsSupported);
        res.send('okay');
    } else {
        res.send('Call /support/<PHONE>/<RCS Agent Id>');
    }
})

/**
 * Get a single temaplte by id
 */
app.get('/api/templates/:id', async (req, res) => {
    const validtoken = await utils.validateAuthTokenFromRequest(globalState, req);
    if (!validtoken) {
        return res.status(401).json({
            message: 'Invalid token'
        })
    }
    const { id } = req.params;
    if (!id) {
        return res.status(404).json({ success: false, error: 'please provide a valid id' });
    }
    const template = await globalState.hget(TEMPLATES_TABLENAME, id);
    const parsedTemplate = await JSON.parse(template);
    res.json(parsedTemplate);
});

/**
 * Create a new template
 */
app.post('/api/templates', utils.checkAuthenticated, async (req, res) => {
    const { id, text, senderIdField, rcsEnabled, viberEnabled } = req.body;
    let newTemplate;
    const updatedAt = new Date().toISOString();
    if (id && text && senderIdField) {
        newTemplate = { id, text, senderIdField, rcsEnabled, viberEnabled };
        const created = await globalState.hset(TEMPLATES_TABLENAME, {
            [id]: JSON.stringify({ id, text, senderIdField, updatedAt, rcsEnabled, viberEnabled }),
        });
        res.json({ created, newTemplate });
    } else if (!id && text && senderIdField) {
        let id = uuid();
        newTemplate = { id, text, senderIdField, rcsEnabled, viberEnabled };
        const created = await globalState.hset(TEMPLATES_TABLENAME, {
            [id]: JSON.stringify({
                id,
                text,
                senderIdField,
                updatedAt,
                rcsEnabled,
                viberEnabled,
            }),
        });
        res.json({ created, newTemplate });
    } else {
        res.status(500).json({
            success: false,
            error: 'please provide at least a valid text and senderIdField and also an id in case of updating existing templates.',
        });
    }
});


/**
 * Update existing template
 * March 24
 */
app.put('/api/templates', utils.checkAuthenticated, async (req, res) => {
    const { id, text, senderIdField, rcsEnabled, viberEnabled } = req.body;
    console.log('Data received', req.body)
    if (id && text && senderIdField) {
        const updatedAt = new Date().toISOString();

        const templateExists = await utils.getTemplateById(id, globalState);
        if (!templateExists) {
            return res.status(500).json({
                success: false,
                error: 'Template ID does not exist',
            });
        }

        const updatedTemplate = {
            id,
            text,
            senderIdField,
            rcsEnabled,
            viberEnabled,
            updatedAt,
        }
        await globalState.hset(TEMPLATES_TABLENAME, {
            [id]: JSON.stringify(updatedTemplate),
        });
        res.json({ success: true, updated: true, updatedTemplate });

    } else {
        res.status(500).json({
            success: false,
            error: 'please provide at least a valid text and senderIdField and also an id in case of updating existing templates.',
        });
    }
});

/**
 * Delete a template by ID
 */
app.delete('/api/templates/:id', utils.checkAuthenticated, async (req, res) => {
    try {
        //  Just for debug reasons
        const allTemplates = await globalState.hgetall(TEMPLATES_TABLENAME);
        console.log('Current keys in TEMPLATES:', Object.keys(allTemplates));
        //  Get the ID to delete
        const { id } = req.params;
        if (!id) {
            return res.status(404).json({ success: false, error: 'please provide a valid id' });
        }
        const deleted = await globalState.hdel(TEMPLATES_TABLENAME, [id.toString()]);
        //  Respond
        res.json({ success: true, deleted });
    } catch(ex) {
        console.log('Error deleting template:', ex.message)
        res.json({ success: false, message: ex.message });
    }
});

/**
 * Deletes the keep alive scheduler
 */
app.post('/keepalivepinger', async (req, res) => {
    const resp = await keepAlive.deleteKeepAlive();
    res.send(resp);
});

// End of template APIs

/**
 * Scheduler API that is responsible for starting or stopping 
 * the neru scheduler that constantly checks for new csv files 
 * in the neru assets directory that was specified
 * 
 * The endAtDate and maxInvocations should be removed unless 
 * in debug mode, because this scheduler should always be 
 * running as a cron job.
 * 
 * We could use an env var to define the timeframe or cron 
 * for when it should run.
 */
app.post('/scheduler', async (req, res) => {
    const validtoken = await utils.validateAuthTokenFromRequest(globalState, req);
    if (!validtoken) {
        return res.status(401).json({
            message: 'Invalid token'
        })
    }

    const { command, maxInvocations } = req.body;
    const session = neru.createSession();
    const scheduler = new Scheduler(session);

    if (command == 'start') {
        let startAtDate = new Date(); // default is now
        let endAtDate = new Date();
        endAtDate.setDate(endAtDate.getDate() + 1); // runs for max 1 day
        let until = {};
        let maxInvocationsInt = parseInt(maxInvocations);
        if (maxInvocations && maxInvocationsInt && maxInvocationsInt > 0) {
            until = {
                until: {
                    date: endAtDate.toISOString(), // just ot be sure also limit days for demo purpose
                    maxInvocations: maxInvocationsInt, // max 1 hour with one invocation per minute
                },
            };
        }
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
        res.json({ schedulerCreated });
    } else if (command == 'stop') {
        // delete scheduler with fix name
        const schedulerDeleted = await scheduler.cancel('checkandsender').execute();
        res.json({ schedulerDeleted });
    }
});

/**
 * Process files one by one
 * @param {*} files All the files uploaded by the customer
 * @param {*} assets Provider by Neru to host files (Assets)
 * @param {*} scheduler 
 */
async function processAllFiles(files, assets, scheduler) {
    let interval;
    for (const filename of files) {
        // process and send the file
        console.log('processing file' + filename);
        try {
            //  Get the uploaded file
            const asset = await assets.getRemoteFile(filename).execute();
            console.log(JSON.stringify(asset.toString()));
            records = csvService.fromCsvSync(asset.toString(), {
                columns: true,
                delimiter: ';',
                skip_empty_lines: true,
                skip_lines_with_error: true,
                relax_column_count_more: true,
            });
        } catch (e) {
            console.log('there was an error parsing the csv file' + e);
            await globalState.set('processingState', false);
            // await keepAlive.deleteKeepAlive();
        }
        const secondsTillEndOfDay = utils.secondsTillEndOfDay();
        const secondsNeededToSend = parseInt((records.length - 1) / tps);
        //  Only send if there's enough time till the end of the working day
        if (secondsTillEndOfDay > secondsNeededToSend && utils.timeNow() >= 7) {
            try {
                await globalState.set('processingState', true);
                const newCheck = new Date().toISOString();
                const savedNewCheck = await globalState.set('lastCsvCheck', newCheck);
                console.log(`There are ${secondsTillEndOfDay} sec left and I need ${secondsNeededToSend}`);
                const startProcessingDate = new Date().toISOString();
                console.log('file name: ' + filename);
                const sendingResults = await smsService.sendAllMessages(records, filename, globalState);
                const endProcessingDate = new Date().toISOString();
                const failedResults = sendingResults.filter((result) => result.type);
                const failedSummary = [
                    {
                        failed: failedResults.length,
                        // I need to consider the last object of the array which contains the sms/rcs breakdown
                        successful: sendingResults.length - failedResults.length - 1,
                        smsSent: sendingResults.at(-1).smsCount,
                        rcsSent: sendingResults.at(-1).rcsCount,
                        blackList: sendingResults.at(-1).blackListed,
                        startAt: startProcessingDate,
                        endAt: endProcessingDate,
                    },
                ];
                const failedPath = filename.split('/')[2].replace('.csv', '-failed-output.csv');
                if (failedResults.length > 0) {
                    await utils.writeResults(failedResults, failedPath, constants.failedResultsHeader);
                    await assets.uploadFiles([failedPath], `output/`).execute();
                }
                const path = filename.split('/')[2].replace('.csv', '-output.csv');
                await utils.writeResults(failedSummary, path, constants.failedHeader);
                // await utils.writeResults(resultsToWrite, path, constants.resultsHeader);
                const result = await assets.uploadFiles([path], `output/`).execute();
                const processedPath = filename.split('/')[2].replace('.csv', '-processed.csv');
                const fileMoved = await utils.moveFile(assets, processedPath, 'processed/', records, filename);
                await globalState.set('processingState', false);
                clearInterval(interval);
                // await keepAlive.deleteKeepAlive();
            } catch (e) {
                await globalState.set('processingState', false);
                clearInterval(interval);
                // await keepAlive.deleteKeepAlive();
            }
        } else if (secondsTillEndOfDay < 0) {
            console.log('cannot send, end of day');
        } else if (secondsTillEndOfDay > 0 && secondsNeededToSend > secondsTillEndOfDay) {
            try {
                console.log('there is no time to send all the records. Splitting file... ');
                await globalState.set('processingState', true);
                console.log('I have ' + secondsTillEndOfDay + ' to send');
                //10 % security
                const numberOfRecordsToSend = parseInt(tps * secondsTillEndOfDay * 0.9);
                console.log('I can send ' + numberOfRecordsToSend);
                // send the messages until the end of the allowed period
                try {
                    interval = setInterval(() => {
                        axios.get(`http://${process.env.INSTANCE_SERVICE_NAME}.neru/keepalive`);
                    }, 1000);
                    // if (schedulers.list.indexOf('keepalive') !== -1) await keepAlive.createKeepAlive();
                } catch (e) {
                    console.log('the scheduler already exists');
                }
                const sendingRecords = records.slice(0, numberOfRecordsToSend);
                const startProcessingDate = new Date().toISOString();
                const sendingResults = await smsService.sendAllMessages(sendingRecords, filename, globalState);
                const endProcessingDate = new Date().toISOString();
                const failedResults = sendingResults.filter((result) => result.title);
                const failedSummary = [
                    {
                        failed: failedResults.length,
                        successful: sendingResults.length - failedResults.length,
                        startAt: startProcessingDate,
                        endAt: endProcessingDate,
                        smsSent: sendingResults.at(-1).smsCount,
                        rcsSent: sendingResults.at(-1).rcsCount,
                    },
                ];
                // write the resuls file
                if (failedResults.length > 0) {
                    const failedPath = filename.split('/')[2].replace('.csv', '-failed-1-output.csv');
                    await utils.writeResults(failedResults, failedPath, constants.failedResultsHeader);
                    await assets.uploadFiles([failedPath], `output/`).execute();
                }
                const path = filename.split('/')[2].replace('.csv', '-1-output.csv');
                await utils.writeResults(failedSummary, path, constants.failedHeader);
                await assets.uploadFiles([path], `output/`).execute();

                // move the subfile that has been processed to the processed folder
                const processedPath = filename.split('/')[2].replace('.csv', '-1-processed.csv');
                await utils.moveFile(assets, processedPath, 'processed/', sendingRecords, filename);
                // upload the pending records to be processed next morning
                const newFile = records.slice(numberOfRecordsToSend, records.length);
                const pathToFile = filename.split('/')[2].replace('.csv', '-2.csv');
                await utils.writeResults(newFile, pathToFile, constants.processedFileHeader);
                const result = await assets.uploadFiles([pathToFile], `send/`).execute();
                await globalState.set('processingState', false);
                clearInterval(interval);
                // await keepAlive.deleteKeepAlive();
            } catch (e) {
                await globalState.set('processingState', false);
            }
        }
    }
}

/**
 * Checks for files uploaded by the customer 
 * and sends them if new CSV files exist
 */
app.post('/checkandsend', async (req, res) => {
    console.log('Checking for files and sending if new CSV files exist...');
    const FILETYPES = 'send/';
    const PROCESSEDFILES = 'processedfiles';
    try {
        // create a neru session
        const session = neru.createSession();
        const scheduler = new Scheduler(session);
        // init assets access
        const assets = new Assets(session);
        const lastCheck = await globalState.get('lastCsvCheck');
        const processingFiles = await globalState.get('processingState');
        console.log('processing files ? ' + processingFiles);
        // get file list from assets api
        const assetlist = await assets.list(FILETYPES, false, 10).execute();
        console.log(assetlist);
        let toBeProcessed = [];
        if (!assetlist || !assetlist.res || assetlist.res.length <= 0) {
            console.warn('Found no new csv files in asset list.');
            return res.json({
                success: false,
                error: 'No new files found but no error.',
            });
        }
        assetlist.res.forEach((file) => {
            if (
                file &&
                file.name &&
                file.name.endsWith('.csv') &&
                (!lastCheck || new Date(file.lastModified) > new Date(lastCheck)) &&
                !processingFiles
            ) {
                toBeProcessed.push('/' + file.name);
            } else {
                console.log('I will not send since the file is already processed or there are files being processed');
            }
        });
        processAllFiles(toBeProcessed, assets, scheduler);
        res.sendStatus(200);
    } catch (e) {
        console.log('check and send error: ', e);
        res.sendStatus(500);
    }
});

/**
 * Create a user for the first time.
 * NO NEED TO ADD AUTHENTICATION AT THIS POINT
 * It will create a user ONLY if the Users 
 * table does not exist.
 */
app.post('/admin/users/create', async (req, res) => {
    const fn = require('./actions/admin_create_user');
    fn.action(req, res, globalState);
})

/**
 * Get all users
 * This is for Admin access
 */
app.get('/admin/users', async (req, res) => {
    const validtoken = await utils.validateAuthTokenFromRequest(globalState, req);
    if (!validtoken) {
        return res.status(401).json({
            message: 'Invalid token'
        })
    }
    const fn = require('./actions/admin_get_users');
    fn.action(req, res, globalState);
})

/**
 * Create a temporary scheduler (delete any current running one)
 * This is for Admin access
 */
app.post('/admin/scheduler', utils.checkAuthenticated, async (req, res) => {
    const fn = require('./actions/admin_create_test_scheduler');
    fn.action(req, res);
})

/**
 * Gets all the templates
 * This is for Admin access
 */
app.get('/admin/templates', async (req, res) => {
    const validtoken = await utils.validateAuthTokenFromRequest(globalState, req);
    if (!validtoken) {
        return res.status(401).json({
            message: 'Invalid token'
        })
    }
    const fn = require('./actions/admin_get_templates');
    fn.action(req, res, globalState);
})

/**
 * Send a message using a template
 * This is for customer use.
 */
app.post('/api/messages/send', async (req, res) => {
    const validtoken = await utils.validateAuthTokenFromRequest(globalState, req);
    if (!validtoken) {
        return res.status(401).json({
            message: 'Invalid token'
        })
    }
    const fn = require('./actions/api_messages_send');
    fn.action(req, res, globalState);
})

/**
 * Finally, server will listen on the given port
 */
const PORT = process.env.NERU_APP_PORT || 3000;
app.listen(PORT, async () => {
    console.log(`listening on port ${PORT}!`);
    await globalState.set('processingState', false);
});
