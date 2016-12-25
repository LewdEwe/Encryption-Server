

/*##################################################################################################
	Encryption Server

	This file contains the main server code.

	Copyright (c) 2016-2017 Lewd Ewe Ltd
	License: MIT (details below)
	Contact: Open-source <open-source@lewdewe.com> (http://lewdewe.com)

	**	CAUTION: this application has not yet been vetted by security experts,
	**	you should seek professional advice if running this in a production environment.

	If you create changes that would benefit many people then please offer your changes to us.
	Forking this code should mainly be done to make bespoke or proprietary changes for your
	individual project.

	As use of this software will save you a lot of development time and perhaps earn you income,
	please consider making a suitable monetary contribution via the following services:

	Donorbox:	https://donorbox.org/lewd-ewe-open-source
	Flattr:		https://flattr.com/profile/LewdEwe

	Thank you for your support!

	Have a look at the other software I've open sourced:

	https://bitbucket.org/account/user/lewdeweltd/projects/OS

	Always retain this copyright and license text with the code below. You should not claim any part
	of this work to be originally created by yourself. If any of the code below was sourced from the
	internet then I have attributed it to the origin in the code comments.

	------------------------------------------------------------------------------------------------

	The MIT License

	Permission is hereby granted, free of charge, to any person obtaining a copy of this software
	and associated documentation files (the 'Software'), to deal in the Software without
	restriction, including without limitation the rights to use, copy, modify, merge, publish,
	distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
	Software is furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all copies or
	substantial portions of the Software.

	THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
	BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
	NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
	DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
##################################################################################################*/

"use strict";

// Import dependencies.
let flow =						require('flow');
let net =						require('net');
let sodium =					require('sodium');

// Components.
let config =					require('./config.js');

// Private variables.
let encryption_keys =			{};

let server =					null;

let server_start_time =			null;

let total_stats =				{	// We won't include network bandwidth stats because they are probably better done by a linux system monitor.
								total_requests:					0,
								requests_by_address:			{},
								requests_by_type:				{}
								};
let per_minute_stats =			null;
let last_per_minute_stats =		null;

let last_stats_time =			null;

// Public variables.

// Constants.
const STATS_ENABLED =			true;

/*================================================================================================*/

/*································································································*/
/*
TCP connection handler.

@socket					Object: the TCP socket object for the connection.
*/
function tcp_connection_handler(socket)
	{
	let buffer = '';

	// Ensure we are getting UTF8 data.
	socket.setEncoding('utf8');

	// Setup event handlers for the socket.
	socket
	.on('data', function ouSh72NlFd(data)
		{
		// Add the received data to the buffer.
		buffer += data;

		// The very simple protocol is one request per line, separated by a line feed character.
		let i;
		while((i = buffer.indexOf('\n')) !== -1)
			{
			json_message_handler(socket, buffer.substr(0, i));
			buffer = buffer.substr(i + 1);
			}
		}
	)
	.on('end', function SKvI3xwEQQ()
		{
		// If there is residual data then try processing it.
		if(buffer.length > 0)json_message_handler(socket, buffer);
		}
	);
	}

/*································································································*/
/*
JSON message handler.

@socket					Object: the TCP socket object for the connection.
@json_message			String: the JSON encoded request message.
*/
function json_message_handler(socket, json_message)
	{
	let request;

	// Parse the JSON request.
	try
		{
		request = JSON.parse(json_message);
		}
	catch(e)
		{
		// We still allow processing to continue so that we
		// can include the request in the request stats.
		request = {action: 'parse_error'};
		}

	// Protect against invalid request.
	if(request === null || typeof request !== 'object' || typeof request.action !== 'string')
		{
		request = {action: 'bad_request'};
		}

	if(STATS_ENABLED === true)
		{
		// Get the remote address for the stats.
		// Typically clients will keep the TCP connection open, so request stats will indicate requests
		// per connection, unless a new connection opened from the same address is on the same port.
		let remote_address = socket.remoteAddress + ":" + socket.remotePort;

		// Update the request stats.
		let current_time = Date.now();
		if(per_minute_stats === null || (current_time - last_stats_time) >= 60000)
			{
			last_per_minute_stats = per_minute_stats;
			per_minute_stats = 	{
								total_requests:					1,
								requests_by_address:			{[remote_address]: 1},
								requests_by_type:				{[request.action]: {[remote_address]: 1}}
								};
			last_stats_time = current_time;
			}

		total_stats.total_requests++;

		if(total_stats.requests_by_address[remote_address] === undefined)
			{
			total_stats.requests_by_address[remote_address] = 1;
			}
		else total_stats.requests_by_address[remote_address]++;

		if(total_stats.requests_by_type[request.action] === undefined)
			{
			total_stats.requests_by_type[request.action] = {[remote_address]: 1};
			}
		else
			{
			if(total_stats.requests_by_type[request.action][remote_address] === undefined)
				{
				total_stats.requests_by_type[request.action][remote_address] = 1;
				}
			else total_stats.requests_by_type[request.action][remote_address]++;
			}
		}

	// Process the request.
	flow.exec(
	function dkhRbQ7l3k()
		{
		switch(request.action)
			{
			case 'server_request_stats':
				if(STATS_ENABLED === true)
					{
					this(
						{
						server_start_time:		server_start_time,
						total_stats:			total_stats,
						per_minute_stats:		last_per_minute_stats
						}
					);
					}
				else this(null);
				break;

			case 'create_new_key':
				this(
					{
					key_size:				sodium.Const.SecretBox.keyBytes,
					nonce_size:				sodium.Const.SecretBox.nonceBytes,
					key:					create_new_key()
					}
				);
				break;

			case 'calculate_encrypted_size':
				if(typeof request.data === 'string')
					{
					request.key_name = 'temporary_key_calculate_encrypted_size';
					encryption_keys[request.key_name] = create_new_key();
					let result = encrypt_data(request);
					this('Original size: ' + request.data.length + ' bytes; encrypted size: ' + result.length + ' bytes.');
					}
				else this(null);
				break;

			case 'encrypt':
				this(encrypt_data(request));
				break;

			case 'decrypt':
				this(decrypt_data(request));
				break;

			default:
				this(null);
			}
		},
	function McZpg8r0fE(response_data)
		{
		if(socket.destroyed === false)
			{
			socket.write(JSON.stringify({request_id: request.request_id, data: response_data}) + '\n');
			}
		}
	);
	}

/*································································································*/
/*
Create a new symmetric encryption key.

Returns a hex encoded string of the key.
*/
function create_new_key()
	{
	let key = Buffer.alloc(sodium.Const.SecretBox.keyBytes);
	sodium.Random.stir();
	sodium.Random.buffer(key, sodium.Const.SecretBox.keyBytes);
	return key.toString('hex');
	}

/*································································································*/
/*
Encrypt data using the specified key. Default data encoding is UTF8.
This function snips off the 16 byte zero prefix from the cipher to reduce storage requirements.

@request				Object: the object containing the request details.

Returns a string containing the nonce and encrypted data.
*/
function encrypt_data(request)
	{
	// Check we have the necessary values.
	if(	typeof request.key_name !== 'string' || request.key_name.length === 0 || encryption_keys[request.key_name] === undefined ||
		(request.encoding !== undefined && typeof request.encoding !== 'string') ||
		typeof request.data !== 'string' || request.data.length === 0)
		{
		return null;
		}

	// Create a symmetric encryption secret box.
	let box = new sodium.SecretBox(encryption_keys[request.key_name]);

	// Encrypt the data.
	let encoding = request.encoding || 'utf8';
	let result = box.encrypt(request.data, encoding);

	// Return the encrypted data and nonce as a single string.
	return '$' + result.nonce.toString('base64') + '$' + result.cipherText.slice(16).toString('base64');
	}

/*································································································*/
/*
Decrypt data using the specified key. Default data encoding is UTF8.
This function adds the 16 byte zero prefix back onto the cipher before decrypting.

@request				Object: the object containing the request details.

Returns a buffer containing the decrypted data.
*/
function decrypt_data(request)
	{
	// Check we have the necessary values.
	if(	typeof request.key_name !== 'string' || request.key_name.length === 0 ||
		encryption_keys[request.key_name] === undefined ||
		(request.encoding !== undefined && typeof request.encoding !== 'string') ||
		typeof request.data !== 'string' || request.data.length === 0)
		{
		return null;
		}

	// Create a symmetric encryption secret box.
	let box = new sodium.SecretBox(encryption_keys[request.key_name]);

	// Decrypt and return the plaintext data.
	let index = request.data.lastIndexOf('$');
	let nonce = Buffer.from(request.data.substr(1, index - 1), 'base64');
	let temp = Buffer.from(request.data.substr(index + 1), 'base64');
	let cipher = Buffer.alloc(temp.length + 16);
	temp.copy(cipher, 16);
	let encoding = request.encoding || 'utf8';
	try
		{
		return box.decrypt({nonce: nonce, cipherText: cipher}, encoding);
		}
	catch(e)
		{
		return null;
		}
	}

/*································································································*/
/*
Gracefully shutdown the server and exit the process.
*/
function shutdown_server(callback)
	{
	console.log('Shutting down Encryption server.');

	flow.exec(
	function RAGQmvEg2t()
		{
		// Close the server socket.
		if(server !== null)server.close(this);
		else this();
		},
	function iOF7kqv5GS()
		{
		process.exit(0);
		}
	);
	}

/*================================================================================================*/

console.log('####################################################################################################');
console.log('####################################################################################################');
console.log('Starting Encryption server on ' + config.encryption_server_host + ':' + config.encryption_server_port + '.');

// Load the encryption keys.
for(let i = 0; i < config.encryption_keys.length; i++)
	{
	let item = config.encryption_keys[i];
	encryption_keys[item.name] = Buffer.from(item.key, 'hex');
	}

// Create the TCP server.
server = net.createServer();

// Set the TCP event handlers.
server.on('connection', tcp_connection_handler);

// Start listening for connections.
server.listen(config.encryption_server_port, config.encryption_server_host);

// Initialise statistics data.
server_start_time = Date.now();
last_stats_time = server_start_time;

/*################################################################################################*/

