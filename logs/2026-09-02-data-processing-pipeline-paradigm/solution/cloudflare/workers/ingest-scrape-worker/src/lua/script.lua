local current = redis.call('INCRBY', KEYS[1], ARGV[1])
if tonumber(current) == tonumber(ARGV[1]) then
    redis.call('EXPIRE', KEYS[1], ARGV[2])
end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}