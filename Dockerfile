FROM nginx:alpine

RUN apk add --no-cache nodejs

WORKDIR /app
COPY build.js ./
COPY src/ ./src/
COPY static/ ./static/

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
