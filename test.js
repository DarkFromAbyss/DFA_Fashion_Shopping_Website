// Sử dụng module Pool để quản lý kết nối hiệu quả
const { Pool } = require('pg');

// Cấu hình kết nối cơ sở dữ liệu
// THAY THẾ các giá trị này bằng thông tin của bạn
const pool = new Pool({
  user: 'postgres',       // Tên người dùng PostgreSQL
  host: '127.0.0.1',          // Địa chỉ máy chủ (thường là 'localhost' hoặc IP)
  database: 'demo', // Tên cơ sở dữ liệu
  password: '12345', // Mật khẩu người dùng
  port: 5432,                 // Cổng mặc định của PostgreSQL
});

// THAY THẾ 'your_table_name' bằng tên bảng bạn muốn truy vấn
const tableName = 'test';

/**
 * Hàm thực hiện truy vấn SELECT * FROM một bảng cụ thể
 */
async function getTableData() {
  let client;
  try {
    // Lấy một kết nối từ pool
    client = await pool.connect();

    // Câu lệnh SQL để lấy tất cả các bản ghi từ bảng
    const queryText = `SELECT * FROM ${tableName}`;

    console.log(`Đang thực hiện truy vấn: ${queryText}`);

    // Thực hiện truy vấn
    const result = await client.query(queryText);

    console.log(`✅ Truy vấn thành công! Tổng số hàng: ${result.rowCount}`);
    console.log('--- Dữ liệu lấy được ---');

    // In ra dữ liệu
    console.table(result.rows);
    
    // Trả về mảng chứa các hàng (records)
    return result.rows;

  } catch (err) {
    console.error(`❌ Lỗi khi thực hiện truy vấn hoặc kết nối: ${err.message}`);
    // console.error(err); // Dùng để xem chi tiết lỗi hơn
    throw err;
  } finally {
    // Đảm bảo giải phóng kết nối trở lại pool
    if (client) {
        client.release();
        console.log('Đã giải phóng kết nối.');
    }
    // Đóng pool sau khi hoàn thành công việc
    await pool.end();
    console.log('Pool đã đóng. Kết thúc chương trình.');
  }
}

// Gọi hàm để chạy chương trình
getTableData();