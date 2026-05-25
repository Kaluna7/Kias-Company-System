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
ENV SOP_EXTRACT_MODE=$SOP_EXTRACT_MODE
ENV NEXT_PUBLIC_SOP_EXTRACT_MODE=$NEXT_PUBLIC_SOP_EXTRACT_MODE

RUN npm run build

EXPOSE 3000
CMD ["npm","start"]