#Hệ thống tự động phân tích tối ưu chi phí thực hiện
## 1. Một bộ parse solidity
+ Đọc các keywords và xác định contracts, functions, modifiers, state variables và vị trí của nó (một dạng biểu diễn 
  trung gian dễ dàng cho việc xử lý)
+ Sau khi thực hiện tìm các lỗi, chỉnh sửa ở dạng biểu diễn trung gian đó thì chuyển nó lại về dạng file .sol
  Dùng thư viện: @solidity-parser/parser với input đầu vào sẽ phân tích ra được các hàm, vị trí của từng hàm. 
  Nó cũng cho ra được vị từng token với vị trí của nó (line, column).
  
  Khi dó với việc thay đổi (sửa), thay đổi biến, hàm thì ta sẽ đưa việc sửa về sửa từng token trong contract 
  (cũng giống như việc test)

## 2. Xây dựng các oracle check các trường hợp lỗi+ sửa lỗi
[doc](https://docs.google.com/document/d/1gXV1kZ1GSsGKXdf4-F7bHwbr8yq3CXayAoi7gT0fKaY/edit)
### 2.1 Loại bỏ các event không cần thiết (phụ thuộc vào mức độ quan trọng của event , không custom được)
### 2.2 Chuyển các giá trị từ string sang bytes nếu có thể ( nếu mà string < 32 bytes)
### 2.3 Sắp xếp các thuộc tính trong cấu trúc sao cho lượng bộ nhớ lưu trữ cho các thuộc tính đó là ít nhất
  https://docs.soliditylang.org/en/v0.5.4/miscellaneous.html#layout-of-state-variables-in-storage
  + Loại cơ bản chỉ sử dụng nhiều byte cần thiết để lưu trữ chúng. Khi đó nếu phần lưu trữ còn trong slot không đủ để lưu trữ phần dữ liệu tiếp theo thì nó sẽ được nhảy sang lưu trữ ở slot tiếp theo.
  + Luật: Nhìn vào những state hoặc những struct thì sắp xếp các thuộc tính sao cho ít  chiếm ô nhớ nhất:
  + Bool: 8 bít
  + Uint256: 256 bit = 32 bytes
  + BytesX: X bytes

Bài toán: 
+ Input: Cho 1 tập các số tượng trưng cho các bits để biểu diễn dữ liệu
+ Output: Số tập 32 bytes biểu diễn được nó.    

Ok

[comment]: <> (### 2.4 Thay đổi assert = require. Assert sẽ tiêu thụ hết lượng gas cho phép thực hiện đoạn code đó, còn require thì sẽ trả lại)

[comment]: <> (  + Nếu có assert => chuyển nó sang require)
### 2.5 External function làm giảm gas thực hiện hơn public nếu tham số đầu vào là mảng hoặc là struct
  + Nếu fuction có param là array hoặc struct và hàm đó không có lời gọi internal thì để nó là external thay vì public
OK

[comment]: <> (### 2.6 Modifier có thể không hiệu quả vì nó sẽ làm tăng lượng phí khi thực hiện triển khai)

[comment]: <> (  + Cần xem xét kỹ các xem có nên chuyển từ modifier sang hàm hay không?)

[comment]: <> (### 2.7 Không cần set các biến = giá trị mặc định )

[comment]: <> (  + Nếu state set các gia trị mặc định => xoá đi.)

[comment]: <> (### 2.8 Sử dụng các reason trong require ngắn hơn)

[comment]: <> (  + Tự sửa các reason sang ngắn hơn + tạo 1 comment mapping từ  các kí hiệu required sang  string cũ.)

### 2.9 Tránh việc check code nhiều lần ở nhiều hàm khác nhau
### 2.10 Sử dụng ít hàm hơn có thể tốt hơn
### 2.11 Xoá các biến không cần sử dụng để được nhận lại lượng gas
### 2.12 Dùng hàm delete thay vì set biến = 0;
### 2.13 Hạn chế thay đổi các biến storage (có thể dùng 1biến trung gian để tính toán và lưu lại vào lần cuối cùng)
Nếu trong hàm có phép gán dữ liệu vào biến storage với số lân > 2 thì dùng 1 biến trung gian để lưu giá trị trước 
khi lưu (cần tránh việc các biến storage bị biến đổi )
### 2.14 Hạn chế đọc các biến storage
Nếu trong hàm có đọc đến biến storage với số lần >2 thì lưu biến cần đọc đó ra 1 giá trị trung gian rồi thực hiện đọc.
(cần tránh việc các biến storage bị biến đổi )


https://github.com/ethereum/solidity/issues/6075#issuecomment-472622304

## 3. Xây dựng 1 bộ đo độ hiểu quả
+ Cần triển khai 1 cái local ethereum [link contract](https://github.com/TechBeatle/EthereumSmartContractsDataset)