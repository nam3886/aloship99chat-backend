async function checkColumnExists(tableName, columnName) {
    const result = await sequelize.query(
        `SELECT COUNT(*) AS count 
         FROM information_schema.columns 
         WHERE table_name = :tableName 
         AND column_name = :columnName 
         AND table_schema = :database`,
        {
            replacements: {
                tableName,
                columnName,
                database: 'whoxa_production_db' // Database name from config.json
            },
            type: sequelize.QueryTypes.SELECT
        }
    );

    return result[0].count > 0; // Returns true if the column exists, otherwise false
}
