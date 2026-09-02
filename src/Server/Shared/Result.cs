namespace Knm.Enterprise.Shared;

public class Error
{
    public string Code { get; }
    public string Message { get; }

    public Error(string code, string message)
    {
        Code = code;
        Message = message;
    }

    public static readonly Error None = new(string.Empty, string.Empty);
    public static Error NotFound(string code = "NOT_FOUND", string message = "المورد المطلوب غير موجود") => new(code, message);
    public static Error Validation(string code = "VALIDATION_ERROR", string message = "فشل التحقق من صحة البيانات") => new(code, message);
    public static Error Conflict(string code = "CONFLICT", string message = "حدث تعارض في البيانات") => new(code, message);
    public static Error Unauthorized(string code = "UNAUTHORIZED", string message = "غير مصرح بالوصول") => new(code, message);
    public static Error Forbidden(string code = "FORBIDDEN", string message = "لا تملك الصلاحية الكافية") => new(code, message);
    public static Error Failure(string code = "INTERNAL_ERROR", string message = "حدث خطأ غير متوقع") => new(code, message);
}

public class Result
{
    public bool IsSuccess { get; }
    public bool IsFailure => !IsSuccess;
    public Error Error { get; }

    protected Result(bool isSuccess, Error error)
    {
        if (isSuccess && error != Error.None)
            throw new InvalidOperationException("Success result cannot contain an error.");
        if (!isSuccess && error == Error.None)
            throw new InvalidOperationException("Failure result must contain an error.");

        IsSuccess = isSuccess;
        Error = error;
    }

    public static Result Success() => new(true, Error.None);
    public static Result Failure(Error error) => new(false, error);
}

public class Result<T> : Result
{
    private readonly T? _value;

    public T Value => IsSuccess 
        ? _value! 
        : throw new InvalidOperationException("Cannot access value of a failure result.");

    protected internal Result(T? value, bool isSuccess, Error error) 
        : base(isSuccess, error)
    {
        _value = value;
    }

    public static Result<T> Success(T value) => new(value, true, Error.None);
    public static new Result<T> Failure(Error error) => new(default, false, error);

    public static implicit operator Result<T>(T value) => Success(value);
}
