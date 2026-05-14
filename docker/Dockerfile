FROM node:22.14.0

ARG UNAME=node
ARG UGROUP=node

# Install jq for JSON processing
RUN apt-get update && apt-get install -y jq && rm -rf /var/lib/apt/lists/*

# Install GitHub Copilot CLI and TypeScript language server
RUN yarn global add @github/copilot typescript-language-server typescript

RUN mkdir -p /home/$UNAME/.copilot
RUN chown -R $UNAME:$UGROUP /home/$UNAME/.copilot/
