#!/bin/bash

# Clear local data
mongo friendcare --eval 'db.dropDatabase()'
mongorestore -h localhost dump/friendcare/
