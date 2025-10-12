# Sử dụng base image Node.js
FROM node:20-alpine

# Thiết lập thư mục làm việc bên trong container
WORKDIR /usr/src/app

# Sao chép package.json và package-lock.json để cài đặt dependency
COPY package*.json ./

# Cài đặt dependencies
RUN npm install

# Sao chép toàn bộ code ứng dụng
COPY . .

# Mở cổng mà Express server sẽ lắng nghe
EXPOSE 3000

# Lệnh chạy ứng dụng khi container khởi động
CMD [ "npm", "start" ]