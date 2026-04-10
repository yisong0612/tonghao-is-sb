const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'kk494840',
  database: 'sys',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});


pool.getConnection()
  .then(conn => {
    console.log('✅ Database Connect Successful!');
    conn.release(); 
  })
  .catch(err => {
    console.error('❌ Fail to Connect Database：', err.message);
  });


module.exports = pool;