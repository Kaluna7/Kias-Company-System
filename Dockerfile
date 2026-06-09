FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

COPY prisma ./prisma  

RUN npm install

COPY . .

RUN npx prisma generate

# Vision mode harus ada saat `next build` (NEXT_PUBLIC_* di-bundle ke client)
ARG SOP_EXTRACT_MODE=vision
ARG NEXT_PUBLIC_SOP_EXTRACT_MODE=vision
ARG NEXT_PUBLIC_ONLYOFFICE_URL=http://localhost:8082
ENV SOP_EXTRACT_MODE=$SOP_EXTRACT_MODE
ENV NEXT_PUBLIC_SOP_EXTRACT_MODE=$NEXT_PUBLIC_SOP_EXTRACT_MODE
ENV NEXT_PUBLIC_ONLYOFFICE_URL=$NEXT_PUBLIC_ONLYOFFICE_URL

RUN npm run build

ENV NODE_ENV=production

EXPOSE 3000
CMD ["npm","start"]