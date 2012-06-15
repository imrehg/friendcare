#!/bin/bash

source ../../.env

mongodump -v -u $MONGO_USER -p $MONGO_PASS -h $MONGO_URL -d $MONGO_DB

echo "Dumping finished from $MONGO_URL"
