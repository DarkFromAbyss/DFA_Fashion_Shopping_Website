import sqlite3
import pandas as pd
from sqlite3 import Connection, Cursor
from typing import Optional


class Database:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.connection: Optional[Connection] = None

    def connect(self) -> None:
        """Establish a connection to the SQLite database."""
        if self.connection is None:
            self.connection = sqlite3.connect(self.db_path)
            self.connection.row_factory = sqlite3.Row

    def close(self) -> None:
        """Close the database connection."""
        if self.connection:
            self.connection.close()
            self.connection = None

    def execute(self, query: str, params: tuple = ()) -> Cursor:
        """Execute a SQL query with optional parameters."""
        if self.connection is None:
            raise RuntimeError("Database connection is not established.")
        
        cursor = self.connection.cursor()
        cursor.execute(query, params)
        self.connection.commit()
        return cursor

    def fetchall(self, query: str, params: tuple = ()) -> list[sqlite3.Row]:
        """Fetch all rows from a SQL query."""
        cursor = self.execute(query, params)
        return cursor.fetchall()

    def fetchone(self, query: str, params: tuple = ()) -> Optional[sqlite3.Row]:
        """Fetch a single row from a SQL query."""
        cursor = self.execute(query, params)
        return cursor.fetchone()



# Example usage:
if __name__ == "__main__":
    db = Database("example.db")
    db.connect()
    
    # Users table
    db.execute("""CREATE TABLE IF NOT EXISTS Employees (
                    id_employees INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    sex TEXT NOT NULL,
                    birthday TEXT NOT NULL, 
                    email TEXT NOT NULL, 
                    phone_number INTEGER NOT NULL,
                    username TEXT NOT NULL, 
                    password TEXT NOT NULL);"""
                )
    
    db.execute("""CREATE TABLE IF NOT EXISTS Customers (
                    id_customers INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    sex TEXT NOT NULL,
                    birthday TEXT NOT NULL,
                    email TEXT NOT NULL,
                    phone_number INTEGER NOT NULL,
                    username TEXT NOT NULL,
                    password TEXT NOT NULL);"""
                )
    
    # Hotel table
    db.execute("""CREATE TABLE IF NOT EXISTS Hotels (
                    id_hotels INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    address TEXT NOT NULL,
                    phone_number INTEGER NOT NULL,
                    email TEXT NOT NULL, 
                    description TEXT);"""
                )
    
    db.execute("""CREATE TABLE IF NOT EXISTS Types (
                    id_types INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    area INTEGER NOT NULL, 
                    single_beds INTEGER NOT NULL,
                    double_beds INTEGER NOT NULL,
                    price REAL NOT NULL,
                    description TEXT);"""
                )
    
    db.execute("""CREATE TABLE IF NOT EXISTS Services (
                    id_services INTEGER PRIMARY KEY AUTOINCREMENT,
                    breakfast BOOLEAN NOT NULL,
                    wifi BOOLEAN NOT NULL,
                    fridge BOOLEAN NOT NULL,
                    price REAL NOT NULL,
                    description TEXT);"""
                )
    
    db.execute("""CREATE TABLE IF NOT EXISTS Rooms (
                    id_rooms INTEGER PRIMARY KEY AUTOINCREMENT,
                    id_hotels INTEGER NOT NULL,
                    id_types INTEGER NOT NULL,
                    id_services INTEGER NOT NULL,
                    room_number INTEGER NOT NULL,
                    FOREIGN KEY (id_hotels) REFERENCES Hotels(id_hotels),
                    FOREIGN KEY (id_types) REFERENCES Types(id_types),
                    FOREIGN KEY (id_services) REFERENCES Services(id_services));"""
                )
    
    db.close()