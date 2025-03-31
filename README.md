Neru EOS sample app

## Summary

This application runs in Vonage's VCR, enabling customers to perform sending messages based on templates.
An example of a template could be:

```Hello {{NAME}} This is your code: {{CODE}}```

The placeholders ```NAME``` and ```CODE``` must be replaced with information sent by you in 2 ways: 

1) Uploading a CSV file with customizable key-value pairs. 
When a CSV file is uploaded, a cron job processes its content and sends SMS or RCS messages accordingly.

2) Sending a request to an endpoint.
You can directly send a ```POST``` reques to  ```/api/messages/send``` with the correct information (defined below) and send the message to any number.

## Pre-Requisites

1. Install NodeJS
2. Install [VCR CLI](https://github.com/Vonage/cloud-runtime-cli)
3. Make sure you have a [Vonage account](https://dashboard.nexmo.com/)

## Installation

1. Run `npm install`
2. Run `vcr configure` where you will be asked to set a Vonage apikey and secret.
3. Create a `vcr.yml` file as per `vcr-sample.yml`
4. Environment variables inside `vcr.yml`
    In order to send Viber messages, include your VIBER SERVICE ID
    ```
project:
    name: eos-rcs
instance:
    name: dev
    runtime: nodejs18
    region: aws.euw1
    application-id: dd198654-3249-43fc-b751-222f5ffe7959
    environment:
        - name: VIBER_SERVICE_MESSAGE_ID
            value: "XXXX"
    entrypoint:
        - node
        - index.js
debug:
    application-id: dd198654-3249-43fc-b751-222f5ffe7959
    entrypoint:
        - node
        - index.js
    preserve-data: true
    ```

## Run the project
You will deploy this code in VCR. You can run in **debug** or **prod** mode. 

```
vcr secret create --name apikey --value [YOUR VINAGE API KEY]
vcr secret create --name apiSecret --value [YOUR VONAGE API SECRET]
```

Replace the values within the brackets with the ApiKey and ApiSecret from your Vonage Dashboard.

Init VCR with this information:
```
vcr init
```

### NOTES
Inside your ```vcr.yml``` file, check that application-id is the one you want to use.
```runtime: nodejs16``` is the NodeJS version you are using.

### Deploy
Finally, run ```vcr debug``` to send all the informaiton to VCR. 
This will let you inspect the console and check for errors locally.
You will have a public URL where this NodeJS project is running.

Run ```vcr deploy``` to send the changes and use in VCR.

## Creating the first user
When you first access your VCR URL, you will be asked to create your first user. This action can be performed once.
After this, you will be redirected to the login page.

## Obtaining an Authorisation Token
Authorisation Tokens are used to send requests via Postman or similar.
To create new Authorisation tokens you must send a ```POST``` request to ```/admin/tokens``` with the following body:

```
{
    "password": "YOUR PASSWORD HERE"
}
```

If the token is created you will receive a response like:

```
{
    "success": true,
    "message": "Record created",
    "token": "1a955552-ad8e-4017-8c86-2d9f7eee80f1"
}
```

Use that token in your authorization header. Like ```Bearer 1a955552-ad8e-4017-8c86-2d9f7eee80f1```


## Sending a message without a CSV file
Send a ```POST``` request to ```/api/messages/send/``` with the following body:

```
{
   "message_type": "text",
   "templateId": "1",
    "channel": "sms",
    "from": "447700900001",
    "to": "447700900000",
    "data": [{
        "NAME":"Walter".
        "CODE":"12345"
    }]
}
```

Remember to include the Authorization Token in your header.

The application retrieves the template ID from the payload and sends a message via SMS or RCS, depending on the specified ```channel```. 
The ```data``` object contains key-value pairs used to populate placeholders within the template.

The values in this payload override the template type. If the template specifies SMS but the payload defines RCS, an RCS message will be sent.


## Uploading and using a CSV file to send messages
POST to `/scheduler` with {"command": "start", "maxInvocations": number}

```
Remember to send an Authorization Token in the header
```

This will start a cron job that runs from Monday to Saturday from 6am to 8pm. It will run 2 times every hour (at minute 15 and minute 45)

This scheduler will call the `/checkandsend`endpoint which will check if there are csv files that need to be processed. If there are files that need to be processed, the file will be read, SMS sent and a new CSV file will be created on `/output` directory containing the results of the SMS sending.

## Stopping the app

POST to `/scheduler` with {"command": "stop"}

```
Remember to send an Authorization Token in the header
```
