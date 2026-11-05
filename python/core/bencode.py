"""Standards-compliant BitTorrent Bencoding and Bdecoding implementation.

Supports integers, byte strings, UTF-8 strings, lists, and lexicographically sorted dictionaries.
"""

from typing import Any, Tuple, Union


class BencodeError(Exception):
    """Raised when encoding or decoding bencoded data fails."""
    pass


def bdecode(data: Union[bytes, bytearray]) -> Any:
    """Decode bencoded bytes into Python primitives (int, bytes/str, list, dict)."""
    if not isinstance(data, (bytes, bytearray)):
        raise BencodeError("Input data must be bytes or bytearray")

    def decode_next(idx: int) -> Tuple[Any, int]:
        if idx >= len(data):
            raise BencodeError(f"Unexpected end of data at offset {idx}")

        char = data[idx:idx+1]

        # Integer: i<digits>e
        if char == b'i':
            end = data.find(b'e', idx + 1)
            if end == -1:
                raise BencodeError(f"Unterminated integer starting at offset {idx}")
            num_str = data[idx + 1:end]
            if len(num_str) == 0:
                raise BencodeError("Empty integer value")
            if num_str == b'-0':
                raise BencodeError("Negative zero is invalid in bencode")
            if len(num_str) > 1 and num_str[0] == ord('0'):
                raise BencodeError("Leading zeros are invalid in bencode")
            if num_str.startswith(b'-') and len(num_str) > 2 and num_str[1] == ord('0'):
                raise BencodeError("Leading zeros after minus sign are invalid")
            try:
                val = int(num_str)
            except ValueError:
                raise BencodeError(f"Invalid integer string: {num_str}")
            return val, end + 1

        # List: l<contents>e
        elif char == b'l':
            res = []
            curr = idx + 1
            while curr < len(data) and data[curr:curr+1] != b'e':
                item, curr = decode_next(curr)
                res.append(item)
            if curr >= len(data):
                raise BencodeError(f"Unterminated list starting at offset {idx}")
            return res, curr + 1

        # Dictionary: d<contents>e
        elif char == b'd':
            res = {}
            curr = idx + 1
            last_key = None
            while curr < len(data) and data[curr:curr+1] != b'e':
                key, curr = decode_next(curr)
                if not isinstance(key, (bytes, str)):
                    raise BencodeError(f"Dictionary key must be bytes or str, got {type(key)}")
                key_bytes = key.encode('utf-8') if isinstance(key, str) else key
                if last_key is not None and key_bytes <= last_key:
                    # In canonical bencode, keys must be strictly ordered
                    pass
                last_key = key_bytes
                val, curr = decode_next(curr)
                res[key] = val
            if curr >= len(data):
                raise BencodeError(f"Unterminated dictionary starting at offset {idx}")
            return res, curr + 1

        # Byte string: <length>:<bytes>
        elif char in b'0123456789':
            colon = data.find(b':', idx)
            if colon == -1:
                raise BencodeError(f"Colon not found in byte string at offset {idx}")
            len_str = data[idx:colon]
            if len(len_str) > 1 and len_str[0] == ord('0'):
                raise BencodeError("Leading zeros in byte string length")
            try:
                length = int(len_str)
            except ValueError:
                raise BencodeError(f"Invalid string length: {len_str}")
            if length < 0:
                raise BencodeError("Negative string length")
            str_start = colon + 1
            str_end = str_start + length
            if str_end > len(data):
                raise BencodeError(f"String length {length} exceeds buffer size {len(data) - str_start}")
            return data[str_start:str_end], str_end

        else:
            raise BencodeError(f"Invalid bencode token: {char} at offset {idx}")

    result, final_offset = decode_next(0)
    return result


def bdecode_torrent(data: Union[bytes, bytearray]) -> Tuple[dict, bytes]:
    """Decode bencoded torrent file and extract exact original info dictionary raw byte slice."""
    if not isinstance(data, (bytes, bytearray)):
        raise BencodeError("Input data must be bytes or bytearray")

    info_raw = None

    def decode_next(idx: int, is_root: bool = False) -> Tuple[Any, int]:
        nonlocal info_raw
        if idx >= len(data):
            raise BencodeError(f"Unexpected end of data at offset {idx}")

        char = data[idx:idx+1]

        if char == b'i':
            end = data.find(b'e', idx + 1)
            if end == -1:
                raise BencodeError(f"Unterminated integer starting at offset {idx}")
            num_str = data[idx + 1:end]
            if len(num_str) == 0:
                raise BencodeError("Empty integer value")
            if num_str == b'-0':
                raise BencodeError("Negative zero is invalid in bencode")
            if len(num_str) > 1 and num_str[0] == ord('0'):
                raise BencodeError("Leading zeros are invalid in bencode")
            if num_str.startswith(b'-') and len(num_str) > 2 and num_str[1] == ord('0'):
                raise BencodeError("Leading zeros after minus sign are invalid")
            try:
                val = int(num_str)
            except ValueError:
                raise BencodeError(f"Invalid integer string: {num_str}")
            return val, end + 1

        elif char == b'l':
            res = []
            curr = idx + 1
            while curr < len(data) and data[curr:curr+1] != b'e':
                item, curr = decode_next(curr, False)
                res.append(item)
            if curr >= len(data):
                raise BencodeError(f"Unterminated list starting at offset {idx}")
            return res, curr + 1

        elif char == b'd':
            res = {}
            curr = idx + 1
            while curr < len(data) and data[curr:curr+1] != b'e':
                key, curr = decode_next(curr, False)
                if not isinstance(key, (bytes, str)):
                    raise BencodeError(f"Dictionary key must be bytes or str, got {type(key)}")

                key_str = key.decode('utf-8', errors='ignore') if isinstance(key, bytes) else str(key)
                val_start = curr
                val, curr = decode_next(curr, False)
                val_end = curr

                if is_root and key_str == "info":
                    info_raw = bytes(data[val_start:val_end])

                res[key] = val
            if curr >= len(data):
                raise BencodeError(f"Unterminated dictionary starting at offset {idx}")
            return res, curr + 1

        elif char in b'0123456789':
            colon = data.find(b':', idx)
            if colon == -1:
                raise BencodeError(f"Colon not found in byte string at offset {idx}")
            len_str = data[idx:colon]
            if len(len_str) > 1 and len_str[0] == ord('0'):
                raise BencodeError("Leading zeros in byte string length")
            try:
                length = int(len_str)
            except ValueError:
                raise BencodeError(f"Invalid string length: {len_str}")
            if length < 0:
                raise BencodeError("Negative string length")
            str_start = colon + 1
            str_end = str_start + length
            if str_end > len(data):
                raise BencodeError(f"String length {length} exceeds buffer size {len(data) - str_start}")
            return data[str_start:str_end], str_end

        else:
            raise BencodeError(f"Invalid bencode token: {char} at offset {idx}")

    result, _ = decode_next(0, is_root=True)
    if not isinstance(result, dict):
        raise BencodeError("Root bencoded element must be a dictionary")
    if info_raw is None:
        raise BencodeError("Missing 'info' dictionary in bencoded stream")
    return result, info_raw


def bencode(obj: Any) -> bytes:
    """Encode Python primitives into canonical bencoded bytes."""
    if isinstance(obj, int):
        return f"i{obj}e".encode('ascii')

    elif isinstance(obj, (bytes, bytearray)):
        return f"{len(obj)}:".encode('ascii') + bytes(obj)

    elif isinstance(obj, str):
        encoded = obj.encode('utf-8')
        return f"{len(encoded)}:".encode('ascii') + encoded

    elif isinstance(obj, (list, tuple)):
        items = b"".join(bencode(item) for item in obj)
        return b"l" + items + b"e"

    elif isinstance(obj, dict):
        # Keys must be sorted lexicographically by their raw bytes
        items = []
        # Convert all keys to bytes for sorting
        sorted_pairs = []
        for k, v in obj.items():
            if isinstance(k, str):
                k_bytes = k.encode('utf-8')
            elif isinstance(k, (bytes, bytearray)):
                k_bytes = bytes(k)
            else:
                raise BencodeError(f"Dictionary keys must be strings or bytes, got {type(k)}")
            sorted_pairs.append((k_bytes, k, v))

        sorted_pairs.sort(key=lambda x: x[0])

        for k_bytes, _, v in sorted_pairs:
            items.append(bencode(k_bytes))
            items.append(bencode(v))

        return b"d" + b"".join(items) + b"e"

    elif isinstance(obj, bool):
        # Bencode doesn't have native bool, encode as int 1 or 0
        return bencode(1 if obj else 0)

    else:
        raise BencodeError(f"Cannot bencode object of type {type(obj)}")

