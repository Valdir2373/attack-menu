import os
import pytest

os.environ.setdefault("KEY_CRIP_DATA", "test-key")

from infra.adapters.sql.MySqlDialect import MySqlDialect
from infra.adapters.sql.PostgreSqlDialect import PostgreSqlDialect


class TestMySqlDialectQuoteIdentifier:

    def test_wraps_name_in_backticks(self):
        dialect = MySqlDialect()
        assert dialect.quote_identifier("users") == "`users`"

    def test_wraps_column_name_in_backticks(self):
        dialect = MySqlDialect()
        assert dialect.quote_identifier("email_address") == "`email_address`"

    def test_wraps_reserved_word(self):
        dialect = MySqlDialect()
        assert dialect.quote_identifier("select") == "`select`"


class TestPostgreSqlDialectQuoteIdentifier:

    def test_wraps_name_in_double_quotes(self):
        dialect = PostgreSqlDialect()
        assert dialect.quote_identifier("users") == '"users"'

    def test_wraps_column_name_in_double_quotes(self):
        dialect = PostgreSqlDialect()
        assert dialect.quote_identifier("email_address") == '"email_address"'

    def test_wraps_reserved_word(self):
        dialect = PostgreSqlDialect()
        assert dialect.quote_identifier("order") == '"order"'


class TestMySqlDialectNeedsTextConversion:

    def test_varchar_needs_conversion(self):
        dialect = MySqlDialect()
        assert dialect.needs_text_conversion("varchar") is True

    def test_char_needs_conversion(self):
        dialect = MySqlDialect()
        assert dialect.needs_text_conversion("char") is True

    def test_tinytext_needs_conversion(self):
        dialect = MySqlDialect()
        assert dialect.needs_text_conversion("tinytext") is True

    def test_text_does_not_need_conversion(self):
        dialect = MySqlDialect()
        assert dialect.needs_text_conversion("text") is False

    def test_int_does_not_need_conversion(self):
        dialect = MySqlDialect()
        assert dialect.needs_text_conversion("int") is False

    def test_bigint_does_not_need_conversion(self):
        dialect = MySqlDialect()
        assert dialect.needs_text_conversion("bigint") is False

    def test_blob_does_not_need_conversion(self):
        dialect = MySqlDialect()
        assert dialect.needs_text_conversion("blob") is False

    def test_case_insensitive_varchar(self):
        dialect = MySqlDialect()
        assert dialect.needs_text_conversion("VARCHAR") is True

    def test_case_insensitive_char(self):
        dialect = MySqlDialect()
        assert dialect.needs_text_conversion("CHAR") is True


class TestPostgreSqlDialectNeedsTextConversion:

    def test_character_varying_needs_conversion(self):
        dialect = PostgreSqlDialect()
        assert dialect.needs_text_conversion("character varying") is True

    def test_character_needs_conversion(self):
        dialect = PostgreSqlDialect()
        assert dialect.needs_text_conversion("character") is True

    def test_varchar_needs_conversion(self):
        dialect = PostgreSqlDialect()
        assert dialect.needs_text_conversion("varchar") is True

    def test_char_needs_conversion(self):
        dialect = PostgreSqlDialect()
        assert dialect.needs_text_conversion("char") is True

    def test_text_does_not_need_conversion(self):
        dialect = PostgreSqlDialect()
        assert dialect.needs_text_conversion("text") is False

    def test_integer_does_not_need_conversion(self):
        dialect = PostgreSqlDialect()
        assert dialect.needs_text_conversion("integer") is False

    def test_boolean_does_not_need_conversion(self):
        dialect = PostgreSqlDialect()
        assert dialect.needs_text_conversion("boolean") is False

    def test_json_does_not_need_conversion(self):
        dialect = PostgreSqlDialect()
        assert dialect.needs_text_conversion("json") is False


class TestMySqlDialectAlterColumnToText:

    def test_returns_correct_ddl(self):
        dialect = MySqlDialect()
        ddl = dialect.alter_column_to_text("users", "password")
        assert ddl == "ALTER TABLE `users` MODIFY `password` TEXT"

    def test_uses_backticks_for_table_and_column(self):
        dialect = MySqlDialect()
        ddl = dialect.alter_column_to_text("my_table", "my_col")
        assert "`my_table`" in ddl
        assert "`my_col`" in ddl


class TestPostgreSqlDialectAlterColumnToText:

    def test_returns_correct_ddl(self):
        dialect = PostgreSqlDialect()
        ddl = dialect.alter_column_to_text("users", "password")
        assert ddl == 'ALTER TABLE "users" ALTER COLUMN "password" TYPE TEXT'

    def test_uses_double_quotes_for_table_and_column(self):
        dialect = PostgreSqlDialect()
        ddl = dialect.alter_column_to_text("my_table", "my_col")
        assert '"my_table"' in ddl
        assert '"my_col"' in ddl


class TestMySqlDialectGetPkQuery:

    def test_returns_valid_sql(self):
        dialect = MySqlDialect()
        sql = dialect.get_pk_query()
        assert "PRIMARY" in sql
        assert "COLUMN_NAME" in sql
        assert "KEY_COLUMN_USAGE" in sql

    def test_uses_parameterized_table_name(self):
        dialect = MySqlDialect()
        sql = dialect.get_pk_query()
        assert "%s" in sql


class TestPostgreSqlDialectGetPkQuery:

    def test_returns_valid_sql(self):
        dialect = PostgreSqlDialect()
        sql = dialect.get_pk_query()
        assert "pg_index" in sql
        assert "indisprimary" in sql

    def test_uses_parameterized_table_name(self):
        dialect = PostgreSqlDialect()
        sql = dialect.get_pk_query()
        assert "%s" in sql


class TestMySqlDialectGetColumnTypeQuery:

    def test_returns_valid_sql(self):
        dialect = MySqlDialect()
        sql = dialect.get_column_type_query("users")
        assert "COLUMN_NAME" in sql
        assert "DATA_TYPE" in sql
        assert "information_schema" in sql

    def test_uses_parameterized_query(self):
        dialect = MySqlDialect()
        sql = dialect.get_column_type_query("orders")
        assert "%s" in sql


class TestPostgreSqlDialectGetColumnTypeQuery:

    def test_returns_valid_sql(self):
        dialect = PostgreSqlDialect()
        sql = dialect.get_column_type_query("users")
        assert "column_name" in sql
        assert "data_type" in sql
        assert "information_schema" in sql

    def test_uses_parameterized_query(self):
        dialect = PostgreSqlDialect()
        sql = dialect.get_column_type_query("orders")
        assert "%s" in sql


class TestMySqlDialectBuildUpdate:

    def test_with_pk_column(self):
        dialect = MySqlDialect()
        sql = dialect.build_update("users", "password", "id", 1)
        assert "UPDATE `users` SET `password` = %s WHERE `id` = %s" == sql

    def test_without_pk_column(self):
        dialect = MySqlDialect()
        sql = dialect.build_update("users", "password", None, None)
        assert "UPDATE `users` SET `password` = %s LIMIT 1" == sql


class TestPostgreSqlDialectBuildUpdate:

    def test_with_pk_column(self):
        dialect = PostgreSqlDialect()
        sql = dialect.build_update("users", "password", "id", 1)
        assert 'UPDATE "users" SET "password" = %s WHERE "id" = %s' == sql

    def test_without_pk_column_uses_ctid(self):
        dialect = PostgreSqlDialect()
        sql = dialect.build_update("users", "password", None, None)
        assert "ctid" in sql
        assert '"users"' in sql
