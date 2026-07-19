# Security policy

## Supported versions

Security fixes target the latest released version.

## Reporting

Do not open a public issue for a vulnerability that could expose credentials or
execute unintended commands. Use GitHub private vulnerability reporting on this
repository instead.

Include affected version, operating system, reproduction steps, and impact. You
should receive acknowledgement within seven days.

## Execution boundary

RepoRace creates disposable repository copies, but it is not an OS sandbox.
Configured setup, agent, and check commands execute with the invoking user's
permissions and inherited environment. Use a container or disposable VM for
untrusted repositories, prompts, configs, or agent binaries.
