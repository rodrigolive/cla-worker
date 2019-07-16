# Clarive Worker

__This is the new Clarive Worker agent, rewritten in Node__.

The Clarive worker is one of the available communication methods used for
sending/retrieving files and running commands in remote servers.  The worker is
a _pull_ agent and is ideal for cases where the server where the worker is
running is not directly reacheable from the Clarive server.

Typically the process to connecting your Clarive Server to the rest of your
infrastructure for building, deploying and other DevOps-related activities is
this:

- Download the Clarive Worker binary `cla-worker` in the server
- Register the worker with the server by using a project **passkey**
- Start the worker online or as a daemon
- Run your Clarive rules and pipeline against the worker

#### Clarive server requisites

For the worker to be able to connect, the Clarive web server
must be running with the `pubsub` module active.

By default the pubsub module is active and starts with the rest of
`cla web-start` web services.

#### Worker Capabilities

A worker instance can execute the following actions
on its host server:

- receive a remote file from the Clarive server and write it locally
- send a local file to the Clarive server
- run any arbitary command locally on the server as requested by the Clarive
  server
- eval arbitary Javascript instructions on the server, using exposed or
  imported NodeJS libraries

#### Worker Security

The Worker only runs as the current OS user it has been launched with.  But
commands send by the server could escalate permissions if the user or
executable have some type `sudo` permissions, sticky bit or similar mechanism.

#### Download the Worker

The Clarive Worker is open source and can be downloaded from
the Clarive Github account:

     https://github.com/clarive/cla-worker/releases

The worker is a self-contained binary available for Linux, MacOS and Windows
and has no prerrequisites.

#### Registering the Worker

For a worker to connect to a Clarive server it needs a `passkey`. Passkeys
are available on a project basis. Each Clarive project may or may not have a passkey,
if the project owner or administrator generates one.

    cla-worker register --passkey 123428198291ad98d98c89b8

The registration process will return a ID-token pair that is unique
to this worker instance.

    ℹ Registration token:  97d317df5ad3fbb68334657ec94aefe6
    ℹ Projects registered:  ["CLARIVE"]
    ℹ Start the worker with the following command:

                cla-worker run --id RKmp3hSwb --token 97d317df5ad3fbb68334657ec94aefe6

The registration token returned is the worker "password" to access the server under
a given ID.

!!! important
    The ID-worker pair is analogous to a username/password for
    your worker instance. Keep it in a safe place. If it's compromised
    an attacker could impersonate the worker making the Clarive
    Server believe it's connected to the correct server when in fact it's
    connected to the attacker's infrasctructure. That could end up
    with sensitive information or files being sent by the Clarive Server
    to the compromised worker.

#### `cla-worker.yml`

To keep your registrations safe, use the `cla-worker.yml` file.

By default the `cla-worker.yml` file is loaded from one of the
following 4 possibilities, in order of precedence:

1. from the parameter `--config filepath` or `-c /path/to/cla-worker.yml` is present
2. from the environment variable `CLA_WORKER_CONFIG=/path/to/cla-worker.yml`
3. from the current working directory, from where the binary is started
4. from the user's home directory (environment variable `HOME`)
5. from `/etc/cla-worker.yml`

To save your registration directly to the `cla-worker.yml` file,
use the `--save` or `--save /path/to/cla-worker.yml`:

     cla-worker register --save --passkey 123428198291ad98d98c89b8

#### Structure of the `cla-worker.yml` file

These are the configuration parameters allowed in the config file:

`id` - the unique identifier of the worker
`token` - the token returned by the registration process
`passkey` - the project access key for registering workers
`verbose` - to run the worker in verbose mode, set it to `verbose: true`

#### Assigning an ID to the Worker

Every worker, once registered, will have a corresponding random unique ID
assigned to it.

To make it easier to identify your worker, you can optionally assign it a unique
ID.

    cla-worker register --id myworker --passkey 2323928198291ad98d98c89b8

You can register a worker with the same ID against many projects, but
**never the same worker ID twice for a given project**.

#### Unregistering the worker

To unregister a given Worker from the server, making it available to
re-register with the same ID or simply to decatalog it from the available
worker list, run the following command:

    cla-worker unregister --id myworker --token

#### Running the worker

Once registered, fire-up the worker with the following command using the
ID and token used in the registration:

    cla-worker run --id myworker --token 97d317df5ad3fbb68334657ec94aefe6

Or simply, if you have a `cla-worker.yml` file in your PATH with only one
registration (ID-token pair):

    cla-worker run

Optionally, if you have multiple ID registrations in your `cla-worker.yml` file:

    cla-worker run --id myworker

#### Starting as a daemon

To run the Clarive Worker as a daemon, ie. to start the process
in the background and get control back into the shell, run the following
command:

    cla-worker run --daemon --id myworker --token 97d317df5ad3fbb68334657ec94aefe6

#### Rulebook example

    do:
       - write_file:
           file: /tmp/hello.txt
           body: hello there
       - ship:
           host: abc
           from: /tmp/hello.txt
           to: /tmp/hello2.txt
           mode: file
       - res = shell:
           host: abc
           cmd: 'ls /tmp/'
       - echo: "${res.output}"

